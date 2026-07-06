import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Content, Part } from '@google/genai';
import { toast } from 'sonner';
import { generateId } from '@/lib/utils';
import type {
  AIReportData,
  UserImage,
  ReportMetadata,
  ReportSession,
  Checkpoint,
  RunState,
  PendingMerge,
  TaskPlan,
  TaskPlanStep,
  TaskStatus,
  LoopCursor,
} from '@/lib/types';
import { ParsedNotebook } from '@/lib/parser';
import { useAppStore, WELCOME_MESSAGE, hydrateSession } from '@/lib/store';
import {
  AVAILABLE_MODELS,
  generateReportDeclaration,
  generateKuliahReportDeclaration,
  runAgentLoop,
  buildGenerationPrompt,
  buildEditPrompt,
  buildBatchContinuationMessage,
  GENERATION_SYSTEM_INSTRUCTION,
  EDIT_SYSTEM_INSTRUCTION,
  type CopilotMessage,
  type ToolCallState,
  type AgentLoopCallbacks,
} from '@/lib/ai';
import { TOOL_REGISTRY, type ToolExecutionContext } from '@/lib/ai/tools';
import { applyHunk } from '@/lib/copilot/diff-engine';
import {
  createCheckpoint,
  evictIfOverCap,
  revertToCheckpoint,
} from '@/lib/copilot/checkpoint-store';

export type { CopilotMessage, ToolCallState };

const EMPTY_AI_DATA: AIReportData = {
  preTestAnswers: [],
  postTestAnswers: [],
  alatDanBahan: [],
  stepByStepNarrative: '',
  codeAnalysis: '',
  cellAnalyses: [],
  pendahuluan: '',
};

const MAX_STEER_LENGTH = 4000;

function initialChatHistory(
  session: ReportSession | null | undefined,
): CopilotMessage[] {
  if (session) return hydrateSession(session).chatHistory ?? [WELCOME_MESSAGE];
  return [WELCOME_MESSAGE];
}

/** Validate + sanitize a user-submitted clarification or steer message (Req 11.2). */
function sanitizeUserSubmission(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'Message is empty.' };
  if (trimmed.length > MAX_STEER_LENGTH) {
    return { ok: false, reason: `Message exceeds ${MAX_STEER_LENGTH} characters.` };
  }
  // Strip control characters except \n / \t.
  const cleaned = trimmed.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return { ok: true, value: cleaned };
}

/**
 * Copilot AI orchestrator hook.
 *
 * Phase A (chat persistence + checkpoints + run state) and Phase B/C
 * (multi-tool dispatch, granular tools, pendingMerge gate, clarification,
 * run controls) all flow through this single hook. Heavy logic lives in
 * `runAgentLoop` and the tool registry; the hook is the React/store glue.
 */
export function useCopilotAI(session?: ReportSession | null) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [chatHistory, setChatHistoryLocal] = useState<CopilotMessage[]>(() =>
    initialChatHistory(session),
  );

  // ---------------------------------------------------------------------------
  // Run-state tracking (Phase B/C)
  // ---------------------------------------------------------------------------
  const [runState, setRunState] = useState<RunState>(() => session?.runState ?? 'idle');
  const [iteration, setIteration] = useState(0);
  const [maxLoops, setMaxLoops] = useState(15);
  const [currentTool, setCurrentTool] = useState<ToolCallState | null>(null);
  const [taskPlan, setTaskPlanState] = useState<TaskPlan | null>(() => session?.taskPlan ?? null);
  const [retryStatus, setRetryStatus] = useState<{ attempt: number; total: number; delayMs: number } | null>(null);

  const sessionRef = useRef<ReportSession | null | undefined>(session);
  useEffect(() => {
    sessionRef.current = session;
  });

  const sessionIdRef = useRef<string | undefined>(session?.id);
  useEffect(() => {
    if (session?.id !== sessionIdRef.current) {
      sessionIdRef.current = session?.id;
      setChatHistoryLocal(initialChatHistory(session));
      setRunState(session?.runState ?? 'idle');
      setTaskPlanState(session?.taskPlan ?? null);
      setIteration(0);
      setCurrentTool(null);
      setRetryStatus(null);
    }
  }, [session?.id]);

  const saveSession = useAppStore((s) => s.saveSession);
  const copilotSettings = useAppStore((s) => s.copilotSettings);

  // The active AbortController for the in-flight run, plus a ref for the
  // pending steer message so the user can interrupt mid-run (Req 11).
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingSteerRef = useRef<string | undefined>(undefined);
  const lastCursorRef = useRef<LoopCursor | null>(session?.loopCursor ?? null);
  // Synchronous mirror of `runState` so post-run wrap-up code (DOCX
  // build, success toast) can check the latest value without waiting
  // for React's setState batch to flush. Reading
  // `sessionRef.current?.runState` would read the persisted value via
  // a microtask, which is too late — Stop fires the abort, but the
  // persisted runState only writes on the next deferred patch.
  const runStateRef = useRef<RunState>(runState);
  useEffect(() => {
    runStateRef.current = runState;
  }, [runState]);

  /**
   * Flip every still-`thinking` agent message to a finished state and
   * mark any in-flight tool calls as `cancelled`. Used by Pause and
   * Stop so the panel stops showing the spinning "Cognitive Sorting…"
   * row and the orange `Running` tool frames after the user halts a
   * run mid-stream.
   *
   * Uses `setChatHistoryLocal` (not the persisting `setChatHistory`)
   * because it's declared before the write-through wrapper; the next
   * persisted save (e.g. an `onIterationEnd` flush or the next user
   * message) will pick up the cancelled state via the natural store
   * write path.
   */
  const cancelInflightTools = useCallback(() => {
    setStatusText('');
    setCurrentTool(null);
    setChatHistoryLocal((prev) =>
      prev.map((m) => {
        if (m.role !== 'agent') return m;
        if (!m.isThinking && (m.tools ?? []).every((t) => t.status !== 'running')) {
          return m;
        }
        return {
          ...m,
          isThinking: false,
          tools: (m.tools ?? []).map((t) =>
            t.status === 'running' ? { ...t, status: 'cancelled' as const } : t,
          ),
        };
      }),
    );
  }, []);

  /**
   * Persist a partial session patch via the Zustand store. Deferred via
   * a microtask so it never runs inside a React reducer.
   */
  const persistPatch = useCallback(
    (patch: Partial<ReportSession>) => {
      Promise.resolve().then(() => {
        const liveSession = sessionRef.current;
        if (!liveSession) return;
        saveSession({ ...liveSession, ...patch });
      });
    },
    [saveSession],
  );

  // Mirror runState changes back to the persisted session so a tab
  // switch + return shows the right pause/error chrome.
  useEffect(() => {
    if (sessionRef.current && sessionRef.current.runState !== runState) {
      persistPatch({ runState });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState]);

  // Same for the task plan — `set_task_plan` updates flow through onTaskPlan
  // and onTaskStatus; we persist the result so `<ActiveTaskPanel />` can
  // restore the checklist after a tab switch.
  useEffect(() => {
    if (sessionRef.current && sessionRef.current.taskPlan !== taskPlan) {
      persistPatch({ taskPlan });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskPlan]);

  const recordAutoCheckpoint = useCallback(
    (aiData: AIReportData, loopIndex: number) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const chatSnapshot = currentSession.chatHistory ?? [WELCOME_MESSAGE];
      const cursorSnapshot = currentSession.loopCursor ?? null;
      const checkpoint = createCheckpoint({
        source: 'auto',
        label: 'After iteration ' + loopIndex,
        aiData,
        chatHistory: chatSnapshot,
        loopCursor: cursorSnapshot,
      });
      const nextCheckpoints = evictIfOverCap([
        ...(currentSession.checkpoints ?? []),
        checkpoint,
      ]);
      Promise.resolve().then(() => {
        const liveSession = sessionRef.current;
        if (!liveSession) return;
        saveSession({ ...liveSession, checkpoints: nextCheckpoints });
      });
    },
    [saveSession],
  );

  const setChatHistory = useCallback<Dispatch<SetStateAction<CopilotMessage[]>>>(
    (updater) => {
      setChatHistoryLocal((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: CopilotMessage[]) => CopilotMessage[])(prev)
            : updater;
        const currentSession = sessionRef.current;
        if (currentSession) {
          Promise.resolve().then(() => {
            saveSession({ ...currentSession, chatHistory: next });
          });
        }
        return next;
      });
    },
    [saveSession],
  );

  const saveManualCheckpoint = useCallback(
    (label?: string) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const aiData = currentSession.aiData ?? EMPTY_AI_DATA;
      const checkpoint = createCheckpoint({
        source: 'manual',
        label: label ?? new Date().toLocaleString(),
        aiData,
        chatHistory,
        loopCursor: currentSession.loopCursor ?? null,
      });
      const nextCheckpoints = evictIfOverCap([
        ...(currentSession.checkpoints ?? []),
        checkpoint,
      ]);
      Promise.resolve().then(() => {
        const liveSession = sessionRef.current;
        if (!liveSession) return;
        saveSession({ ...liveSession, checkpoints: nextCheckpoints });
      });
    },
    [chatHistory, saveSession],
  );

  const revertToCheckpointById = useCallback(
    (id: string) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const result = revertToCheckpoint(currentSession.checkpoints ?? [], id);
      if (!result.snapshot) return;
      const { snapshot, newCheckpoints } = result;
      const restoredHistory: CopilotMessage[] = [
        ...snapshot.chatHistorySnapshot,
        { role: 'system', text: `Reverted to checkpoint ${snapshot.label}` },
      ];
      setChatHistoryLocal(restoredHistory);
      setRunState('idle');
      Promise.resolve().then(() => {
        const liveSession = sessionRef.current;
        if (!liveSession) return;
        saveSession({
          ...liveSession,
          aiData: snapshot.aiDataSnapshot,
          chatHistory: restoredHistory,
          checkpoints: newCheckpoints,
          loopCursor: snapshot.loopCursorSnapshot,
          runState: 'idle',
          pendingMerge: null,
        });
      });
    },
    [saveSession],
  );

  /**
   * Snapshot the current state right BEFORE pushing a new user
   * instruction, so the per-message undo arrow (Cursor-style ↶) can
   * roll the report back to that point. Returns the new checkpoint's
   * id so the caller can stash it on the user message via
   * `precedingCheckpointId`.
   *
   * Why we snapshot here rather than relying on the auto-checkpoint
   * fired after each iteration: those happen AFTER the merge, so
   * there's no clean handle for "the state right before the user
   * said this." This pre-instruction snapshot fills that gap.
   *
   * Eviction follows the same 50-cap rule as auto checkpoints.
   */
  const snapshotBeforeUserMessage = useCallback(
    (userMessage: string): string | undefined => {
      const currentSession = sessionRef.current;
      if (!currentSession) return undefined;
      const aiData = currentSession.aiData ?? EMPTY_AI_DATA;
      // Only snapshot when there's actual aiData to roll back to.
      // Pre-generation user messages have nothing to undo.
      if (
        !currentSession.aiData ||
        (aiData.preTestAnswers.length === 0 &&
          aiData.postTestAnswers.length === 0 &&
          (aiData.alatDanBahan ?? []).length === 0 &&
          !aiData.stepByStepNarrative &&
          !aiData.codeAnalysis &&
          !aiData.pendahuluan)
      ) {
        return undefined;
      }
      const truncated =
        userMessage.length > 60 ? userMessage.slice(0, 57) + '…' : userMessage;
      const checkpoint = createCheckpoint({
        source: 'auto',
        label: `Before: ${truncated}`,
        aiData,
        chatHistory: currentSession.chatHistory ?? [WELCOME_MESSAGE],
        loopCursor: currentSession.loopCursor ?? null,
      });
      const nextCheckpoints = evictIfOverCap([
        ...(currentSession.checkpoints ?? []),
        checkpoint,
      ]);
      Promise.resolve().then(() => {
        const liveSession = sessionRef.current;
        if (!liveSession) return;
        saveSession({ ...liveSession, checkpoints: nextCheckpoints });
      });
      return checkpoint.id;
    },
    [saveSession],
  );

  /**
   * Undo back to the state that existed BEFORE the user message with
   * the given id. Reads `precedingCheckpointId` off that message and
   * delegates to `revertToCheckpointById`. Used by the per-message ↶
   * arrow on hover.
   *
   * After revert, the chat thread is also truncated so the undone
   * message (and everything after it) disappears — `revertToCheckpointById`
   * already restores the chatHistory snapshot stored at the time the
   * checkpoint was minted, which IS the pre-message thread.
   */
  const undoToMessage = useCallback(
    (messageId: string) => {
      const target = chatHistory.find((m) => m.id === messageId);
      if (!target?.precedingCheckpointId) return;
      revertToCheckpointById(target.precedingCheckpointId);
    },
    [chatHistory, revertToCheckpointById],
  );

  // ---------------------------------------------------------------------------
  // Run controls (Phase A/B)
  // ---------------------------------------------------------------------------

  /**
   * Pause the in-flight run at the next safe boundary. The agent loop
   * preserves the cursor; Continue resumes from it (Req 3.2).
   */
  const pause = useCallback(() => {
    abortControllerRef.current?.abort('pause');
    setRunState('paused');
    setRetryStatus(null);
    cancelInflightTools();
  }, []);

  /**
   * Stop the run. Same boundary semantics as Pause but the cursor is
   * cleared so Continue is no longer available (Req 3.3).
   */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort('stop');
    setRunState('stopped');
    setRetryStatus(null);
    setIsGenerating(false);
    cancelInflightTools();
    persistPatch({ loopCursor: null, runState: 'stopped' });
    setChatHistory((prev) => [...prev, { role: 'system', text: 'Run stopped by user.' }]);
  }, [persistPatch, setChatHistory]);

  // PendingMerge surface (Phase C — Req 5.4 / 5.5 / 5.6)
  const pendingMerge = useMemo<PendingMerge | null>(
    () => session?.pendingMerge ?? null,
    [session?.pendingMerge],
  );

  const acceptHunk = useCallback(
    (hunkId: string) => {
      const currentSession = sessionRef.current;
      if (!currentSession?.pendingMerge) return;
      const pending = currentSession.pendingMerge;
      const target = pending.hunks.find((h) => h.id === hunkId);
      if (!target) return;
      const baseAi = currentSession.aiData ?? EMPTY_AI_DATA;
      const nextAi = applyHunk(baseAi, target);
      const remaining = pending.hunks.filter((h) => h.id !== hunkId);
      const nextPending: PendingMerge | null =
        remaining.length === 0
          ? null
          : { ...pending, hunks: remaining, baseSnapshot: nextAi };
      persistPatch({ aiData: nextAi, pendingMerge: nextPending });
    },
    [persistPatch],
  );

  const rejectHunk = useCallback(
    (hunkId: string) => {
      const currentSession = sessionRef.current;
      if (!currentSession?.pendingMerge) return;
      const pending = currentSession.pendingMerge;
      const target = pending.hunks.find((h) => h.id === hunkId);
      if (!target) return;
      const remaining = pending.hunks.filter((h) => h.id !== hunkId);
      const nextPending: PendingMerge | null =
        remaining.length === 0 ? null : { ...pending, hunks: remaining };
      setChatHistory((prev) => [
        ...prev,
        { role: 'system', text: `Rejected change: ${target.id}` },
      ]);
      persistPatch({ pendingMerge: nextPending });
    },
    [persistPatch, setChatHistory],
  );

  const acceptAllHunks = useCallback(() => {
    const currentSession = sessionRef.current;
    if (!currentSession?.pendingMerge) return;
    const pending = currentSession.pendingMerge;
    persistPatch({ aiData: pending.mergedSnapshot, pendingMerge: null });
  }, [persistPatch]);

  const rejectAllHunks = useCallback(() => {
    const currentSession = sessionRef.current;
    if (!currentSession?.pendingMerge) return;
    setChatHistory((prev) => [
      ...prev,
      { role: 'system', text: 'Rejected all pending changes.' },
    ]);
    persistPatch({ pendingMerge: null });
  }, [persistPatch, setChatHistory]);

  /**
   * Submit a clarification reply or a mid-run steer. When the agent is
   * paused awaiting a question, the reply clears `pendingClarification`;
   * either way, the message becomes the next iteration's user turn.
   */
  const submitClarification = useCallback(
    (raw: string): { ok: boolean; reason?: string } => {
      const result = sanitizeUserSubmission(raw);
      if (result.ok === false) {
        return { ok: false, reason: result.reason };
      }
      pendingSteerRef.current = result.value;
      const messageId = generateId();
      const checkpointId = snapshotBeforeUserMessage(result.value);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'user',
          text: result.value,
          id: messageId,
          precedingCheckpointId: checkpointId,
        },
      ]);
      persistPatch({ pendingClarification: null, pendingUserSteer: result.value });
      return { ok: true };
    },
    [persistPatch, setChatHistory, snapshotBeforeUserMessage],
  );

  const checkpoints = useMemo<Checkpoint[]>(
    () => session?.checkpoints ?? [],
    [session?.checkpoints],
  );

  /**
   * Reset the chat thread to a fresh welcome message and clear any
   * agent state that would leak across the boundary (pending merge,
   * pending clarification, task plan, loop cursor). Intended for the
   * "New chat" / + icon in the panel header. Does NOT touch
   * `aiData`, `checkpoints`, or any uploaded files — those belong to
   * the session and a chat reset shouldn't take them with it.
   *
   * The current thread (if it has any user-authored content) is
   * ARCHIVED to `session.chatThreads` so the user can re-open it
   * later via the History drawer (per-report history, Cursor-style).
   */
  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort('stop');
    abortControllerRef.current = null;
    pendingSteerRef.current = undefined;

    // Archive the current thread if it carries any user content
    // worth keeping. A thread with only the welcome agent message is
    // not worth archiving — that would clutter History with empties.
    const currentSession = sessionRef.current;
    let nextThreads = currentSession?.chatThreads ?? [];
    if (currentSession) {
      const live = currentSession.chatHistory ?? [];
      const hasUser = live.some((m) => m.role === 'user');
      if (hasUser) {
        const firstUser = live.find((m) => m.role === 'user');
        const title =
          firstUser?.text?.slice(0, 60).replace(/\s+/g, ' ').trim() ||
          new Date().toLocaleString();
        const lastTs = live.length
          ? Date.now()
          : (currentSession.updatedAt ?? Date.now());
        nextThreads = [
          ...nextThreads,
          {
            id: generateId(),
            title,
            createdAt: Date.now(),
            updatedAt: lastTs,
            messages: live,
          },
        ];
      }
    }

    setChatHistoryLocal([WELCOME_MESSAGE]);
    setRunState('idle');
    setRetryStatus(null);
    setTaskPlanState(null);
    setIteration(0);
    setCurrentTool(null);
    setStatusText('');
    setIsGenerating(false);
    persistPatch({
      chatHistory: [WELCOME_MESSAGE],
      chatThreads: nextThreads,
      runState: 'idle',
      loopCursor: null,
      pendingMerge: null,
      pendingClarification: null,
      pendingUserSteer: null,
      taskPlan: null,
    });
  }, [persistPatch]);

  /**
   * Re-open an archived thread by id. The live thread is archived
   * first (same rules as `clearChat`) so the user never loses
   * in-flight context, then the chosen thread becomes the new live
   * `chatHistory` and is removed from `chatThreads`.
   */
  const openThread = useCallback(
    (threadId: string) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const threads = currentSession.chatThreads ?? [];
      const target = threads.find((t) => t.id === threadId);
      if (!target) return;

      // Archive the live thread if non-empty, mirroring clearChat.
      const live = currentSession.chatHistory ?? [];
      const hasUser = live.some((m) => m.role === 'user');
      let nextThreads = threads.filter((t) => t.id !== threadId);
      if (hasUser) {
        const firstUser = live.find((m) => m.role === 'user');
        const title =
          firstUser?.text?.slice(0, 60).replace(/\s+/g, ' ').trim() ||
          new Date().toLocaleString();
        nextThreads = [
          ...nextThreads,
          {
            id: generateId(),
            title,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: live,
          },
        ];
      }

      abortControllerRef.current?.abort('stop');
      abortControllerRef.current = null;
      pendingSteerRef.current = undefined;
      setChatHistoryLocal(target.messages);
      setRunState('idle');
      setRetryStatus(null);
      setTaskPlanState(null);
      setIteration(0);
      setCurrentTool(null);
      setStatusText('');
      setIsGenerating(false);
      persistPatch({
        chatHistory: target.messages,
        chatThreads: nextThreads,
        runState: 'idle',
        loopCursor: null,
        pendingMerge: null,
        pendingClarification: null,
        pendingUserSteer: null,
        taskPlan: null,
      });
    },
    [persistPatch],
  );

  /** Permanently remove an archived thread. */
  const deleteThread = useCallback(
    (threadId: string) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const threads = (currentSession.chatThreads ?? []).filter(
        (t) => t.id !== threadId,
      );
      persistPatch({ chatThreads: threads });
    },
    [persistPatch],
  );

  /** Live thread + archived threads, exposed to the UI for the History drawer. */
  const chatThreads = useMemo(
    () => session?.chatThreads ?? [],
    [session?.chatThreads],
  );

  // Persist model selection across reloads (Req: refresh keeps last
  // chosen model). The hook is the only consumer of the slice; the
  // setter is forwarded so existing call sites still work.
  const selectedModelName = useAppStore((s) => s.selectedModelName);
  const setSelectedModelName = useAppStore((s) => s.setSelectedModelName);

  const buildAndSetDocx = async (
    metadata: ReportMetadata,
    combinedParsedNotebooks: ParsedNotebook[],
    accumulatedAiData: AIReportData,
    preTestImages: UserImage[],
    implImages: UserImage[],
    postTestImages: UserImage[],
    modulContext: string,
    postTest: string,
    numImplNotebooks: number,
    setGeneratedDocxBlob: (blob: Blob | null) => void,
  ) => {
    let logoBlob: Blob | null = null;
    try {
      const res = await fetch('/logo-uad.png');
      if (res.ok) logoBlob = await res.blob();
    } catch (e) {
      console.warn('Gagal memuat logo:', e);
    }
    const { generateDocx } = await import('@/lib/docx');
    const docxBlob = await generateDocx(
      metadata,
      combinedParsedNotebooks,
      accumulatedAiData,
      logoBlob,
      preTestImages,
      implImages,
      postTestImages,
      modulContext,
      postTest,
      numImplNotebooks,
    );
    setGeneratedDocxBlob(docxBlob);
  };

  /** Build callbacks for the agent loop, bridging into React state + the store. */
  const makeAgentCallbacks = (
    setAiPreviewData: (data: AIReportData) => void,
  ): AgentLoopCallbacks & { activeMsgId: string } => {
    const handle = { activeMsgId: '' };

    return Object.assign(handle, {
      onStatus: (s: string) => setStatusText(s),

      onIterationStart: (loop: number) => {
        const id = generateId();
        handle.activeMsgId = id;
        setIteration(loop);
        setRetryStatus(null);
        setChatHistory((prev) => [
          ...prev,
          { role: 'agent', text: '', isThinking: true, id, tools: [] },
        ]);
        return id;
      },

      onText: (text: string) => {
        const id = handle.activeMsgId;
        setChatHistory((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
      },

      onThought: (thought: string) => {
        const id = handle.activeMsgId;
        setChatHistory((prev) => prev.map((m) => (m.id === id ? { ...m, thought } : m)));
      },

      onToolUpdate: (tools: ToolCallState[]) => {
        const id = handle.activeMsgId;
        setCurrentTool(tools[tools.length - 1] ?? null);
        setChatHistory((prev) => prev.map((m) => (m.id === id ? { ...m, tools } : m)));
      },

      onPreviewMerge: setAiPreviewData,

      onMergeComplete: (next: AIReportData) => {
        setAiPreviewData(next);
      },

      onCheckpointRequest: ({ aiData, loopIndex }: { aiData: AIReportData; loopIndex: number }) => {
        recordAutoCheckpoint(aiData, loopIndex);
      },

      onIterationEnd: (msgId: string, finalTools: ToolCallState[]) => {
        setChatHistory((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, isThinking: false, tools: finalTools } : m,
          ),
        );
      },

      onSystemMessage: (text: string) => {
        setChatHistory((prev) => [...prev, { role: 'system', text }]);
      },

      onLoopCursorUpdate: (cursor: LoopCursor) => {
        lastCursorRef.current = cursor;
        persistPatch({ loopCursor: cursor });
      },

      onRetryAttempt: (attempt: number, delayMs: number) => {
        setRetryStatus({ attempt, total: 5, delayMs });
      },

      // ----- Phase B / C additions -----

      onTaskPlan: (steps: TaskPlanStep[]) => {
        setTaskPlanState({ steps, setAtIteration: iteration });
      },

      onTaskStatus: (id: string, status: TaskStatus) => {
        setTaskPlanState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            steps: prev.steps.map((s) => (s.id === id ? { ...s, status } : s)),
          };
        });
      },

      onClarification: (question: string) => {
        // Atomic block per Req 6.4: pause, system message, persist
        // pendingClarification, transition runState. All in one tick
        // so the Continue button never appears partially-disabled.
        setRunState('paused');
        setChatHistory((prev) => [
          ...prev,
          { role: 'system', text: `❓ ${question}` },
        ]);
        persistPatch({
          runState: 'paused',
          pendingClarification: { question, askedAt: Date.now() },
        });
      },

      onTaskComplete: (summary?: string) => {
        if (summary) {
          setChatHistory((prev) => [...prev, { role: 'agent', text: summary }]);
        }
        // Flip every still-pending or active step to `done` so the
        // user sees a fully checked-off plan as the terminal frame
        // (Req 10.3). The agent often forgets to call
        // `update_task_status` for the last step before
        // `mark_task_complete`; this catches that.
        setTaskPlanState((prev) => {
          if (!prev) return prev;
          if (prev.steps.every((s) => s.status === 'done')) return prev;
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.status === 'done' ? s : { ...s, status: 'done' as const },
            ),
          };
        });
        setRunState('idle');
        persistPatch({ runState: 'idle', loopCursor: null });
      },

      onPendingMerge: (pm: PendingMerge) => {
        // Auto-accept OFF: stash the merge, pause for review.
        setRunState('paused');
        persistPatch({ pendingMerge: pm, runState: 'paused' });
      },
    });
  };

  /**
   * Orchestrate one full run of `runAgentLoop`. Sets up the abort
   * controller, run state, and error fallback. Used by both
   * `generateReport` and `compileEdit`.
   */
  const runAgent = async (
    apiKeyToUse: string,
    args: {
      modelId: string;
      contents: Content[];
      systemInstruction: string;
      declaration: unknown;
      maxLoops: number;
      sysMsgBuilder: (loop: number) => string;
      mode: 'append' | 'replace';
      initial: AIReportData;
      ctx: ToolExecutionContext;
      declarationKey: 'praktikum' | 'kuliah';
      callbacks: ReturnType<typeof makeAgentCallbacks>;
      resumeCursor?: LoopCursor;
    },
  ): Promise<AIReportData> => {
    // Fresh abort controller per run.
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    // Wipe any stale task plan from a previous run BEFORE the SDK call
    // begins (Req 10.1). Without this, an old plan rendered as
    // unchecked circles even though the previous run had already
    // completed — the user sees ghost steps from history. Resume
    // (continueRun) preserves the plan because that path passes
    // `resumeCursor` and we want progress continuity (Req 10.2).
    if (!args.resumeCursor) {
      setTaskPlanState(null);
      persistPatch({ taskPlan: null });
    }
    setRunState('running');
    setMaxLoops(args.maxLoops);
    setIteration(args.resumeCursor?.iterationIndex ?? 0);
    persistPatch({ runState: 'running' });

    // Consume any pending steer from the ref. The agent loop receives
    // it via `pendingUserSteer` and clears its own copy after injection.
    const steer = pendingSteerRef.current;
    pendingSteerRef.current = undefined;

    try {
      const result = await runAgentLoop({
        apiKey: apiKeyToUse,
        modelId: args.modelId,
        contents: args.contents,
        systemInstruction: args.systemInstruction,
        declaration: args.declaration,
        maxLoops: args.maxLoops,
        sysMsgBuilder: args.sysMsgBuilder,
        mode: args.mode,
        initial: args.initial,
        callbacks: args.callbacks,
        signal: signal,
        resumeCursor: args.resumeCursor,
        extraTools: { declarations: [...TOOL_REGISTRY.declarations] },
        ctx: args.ctx,
        enableGoogleSearch: copilotSettings.googleSearch,
        enableCodeExecution: copilotSettings.codeExecution,
        autoAccept: copilotSettings.autoAccept,
        pendingUserSteer: steer,
        declarationKey: args.declarationKey,
      });

      // Honor explicit Stop / Pause: we already set runState above.
      const reason = signal.reason;
      if (reason === 'stop' || reason === 'pause') {
        return result;
      }
      // Natural termination — only flip to idle if we didn't already
      // transition to paused (e.g. via clarification or pendingMerge).
      setRunState((prev) => (prev === 'running' ? 'idle' : prev));
      return result;
    } catch (err: unknown) {
      // Aborts (Pause / Stop) come through here too because the SDK
      // rejects in-flight on signal abort. Don't surface those as
      // errors — the pause / stop callbacks already updated the state.
      if (signal.aborted) {
        return EMPTY_AI_DATA;
      }
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setRunState('error');
      setRetryStatus(null);
      cancelInflightTools();
      persistPatch({ runState: 'error' });
      setChatHistory((prev) => [
        ...prev,
        { role: 'system', text: `Error: ${msg}. Click Continue to retry.` },
      ]);
      throw err;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  /**
   * Resume from the last persisted cursor. Wired to the Continue button.
   */
  const continueRun = useCallback(async () => {
    if (isGenerating) return;
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const cursor = currentSession.loopCursor ?? lastCursorRef.current;
    if (!cursor) return;
    const apiKeyToUse = process.env.GEMINI_API_KEY || useAppStore.getState().geminiApiKey;
    if (!apiKeyToUse) {
      toast.error('API Key Gemini belum diatur.');
      return;
    }

    // Clear any pendingClarification — the user just submitted, the
    // submitClarification path queued the steer via pendingSteerRef.
    if (currentSession.pendingClarification) {
      persistPatch({ pendingClarification: null });
    }

    setIsGenerating(true);
    try {
      const setAiPreviewData = (next: AIReportData) => {
        const liveSession = sessionRef.current;
        if (liveSession) saveSession({ ...liveSession, aiData: next });
      };
      const callbacks = makeAgentCallbacks(setAiPreviewData);
      const declaration =
        cursor.declarationKey === 'kuliah'
          ? generateKuliahReportDeclaration
          : generateReportDeclaration;
      await runAgent(apiKeyToUse, {
        modelId: cursor.modelId,
        contents: cursor.contents,
        systemInstruction: cursor.systemInstruction,
        declaration,
        maxLoops: cursor.maxLoops,
        sysMsgBuilder: (loop) => buildBatchContinuationMessage(loop, 0),
        mode: cursor.mode,
        initial: cursor.accumulatedAiData,
        ctx: defaultCtx(cursor.accumulatedAiData),
        declarationKey: cursor.declarationKey,
        callbacks,
        resumeCursor: cursor,
      });
    } finally {
      setIsGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateReport = async ({
    metadata,
    preTest,
    preTestImages,
    modulContext,
    postTest,
    postTestImages,
    implImages,
    parsedNotebooks,
    notebookFiles,
    postTestParsedNotebooks,
    postTestNotebookFiles,
    ulasanPraktikum,
    session: sessionArg,
    store,
    setAiPreviewData,
    setGeneratedDocxBlob,
  }: any) => {
    if (isGenerating) return;
    try {
      const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
      if (!apiKeyToUse) {
        toast.error('API Key Gemini belum diatur. Silakan tambahkan di pengaturan Word Options.');
        return;
      }

      if (!preTestImages || preTestImages.length === 0) {
        toast.warning('Lembar pretest belum dimasukkan! Laporan akan dibuat tanpa data pretest.');
      }

      setIsGenerating(true);
      setProgress(10);
      setStatusText('Mempersiapkan data file & melabeli index gambar...');
      setGeneratedDocxBlob(null);

      let notebookPromptData = 'No notebook provided. Rely on images and context.';
      const combinedParsedNotebooks = [...parsedNotebooks, ...postTestParsedNotebooks];
      const notebookImagesToAppend: { nbIdx: number; cellIdx: number; base64: string }[] = [];

      if (combinedParsedNotebooks.length > 0) {
        setStatusText('Mengekstrak visual output dari Notebook...');
        const allCells: any[] = [];
        let imageCounter = 0;
        combinedParsedNotebooks.forEach((nb, nbIdx) => {
          if (!nb) return;
          nb.cells.forEach((c: any, idx: number) => {
            const textOutputs: any[] = [];
            c.outputs?.forEach((o: any) => {
              if (o.type === 'text') {
                textOutputs.push({ type: 'text', content: o.content });
              } else if (o.type === 'html' && o.fallbackText) {
                textOutputs.push({ type: 'text', content: o.fallbackText });
              }
            });
            const imageOutputs = c.outputs?.filter((o: any) => o.type === 'image');
            if (imageOutputs && imageOutputs.length > 0) {
              textOutputs?.push({
                type: 'system_note',
                content: `[VISUAL OUTPUT GENERATED: Sel ini menghasilkan ${imageOutputs.length} gambar/grafik/plot. AI WAJIB membaca dan mendeskripsikan secara mendalam grafik ini (tren, angka korelasi, makna) di dalam kolom 'explanation'.]`,
              });
              imageOutputs.forEach((imgOut: any) =>
                notebookImagesToAppend.push({ nbIdx, cellIdx: idx, base64: imgOut.content }),
              );
            }
            let cleanSource = c.source;
            if (cleanSource) {
              const regex = /!\[(.*?)\]\((data:image\/(.*?);base64,(.*?))\)/g;
              cleanSource = cleanSource.replace(regex, (_match: string, alt: string) => {
                imageCounter++;
                return `[Image Omitted: ${alt || `Notebook_Image_${imageCounter}`}]`;
              });
              const htmlRegex = /<img[^>]+src=["'](data:image\/[^;]+;base64,[^"']+)["'][^>]*>/gi;
              cleanSource = cleanSource.replace(htmlRegex, () => {
                imageCounter++;
                return `[Image Omitted: HTML_Image_${imageCounter}]`;
              });
            }
            allCells.push({
              notebookIndex: nbIdx,
              notebookFileName:
                nbIdx < parsedNotebooks.length
                  ? notebookFiles[nbIdx]?.name
                  : postTestNotebookFiles[nbIdx - parsedNotebooks.length]?.name,
              cellIndex: idx,
              type: c.cell_type,
              source: cleanSource,
              outputs: textOutputs,
            });
          });
        });
        notebookPromptData = JSON.stringify(allCells);
      }

      const totalImages =
        preTestImages.length + implImages.length + postTestImages.length + notebookImagesToAppend.length;
      const isKuliah = metadata.reportType === 'kuliah';

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'user',
          text: `Tolong analisa data praktikum ini secara teliti dan persiapkan laporan beserta dokumen docx-nya. Terdapat total ${totalImages} lampiran visual.`,
          id: generateId(),
          // No precedingCheckpointId — this is the kickoff message and
          // there's no prior aiData to roll back to. The per-message
          // undo arrow only renders when this field is set.
        },
      ]);

      setProgress(30);
      setStatusText('Menganalisis prompt dan konteks praktikum...');

      const prompt = buildGenerationPrompt({
        isKuliah,
        totalImages,
        judulLaporan: sessionArg?.metadata?.judulPertemuan || '',
        mataPraktikum: sessionArg?.metadata?.mataPraktikum || '',
        preTest,
        modulContext,
        postTest,
        ulasanPraktikum,
        notebookPromptData,
      });

      const initialParts: Part[] = [{ text: prompt } as Part];
      const addImagesToContent = (imgs: UserImage[], category: string) => {
        if (imgs.length === 0) return;
        initialParts.push({ text: `\n--- [KATEGORI UPLOAD: ${category}] ---` } as Part);
        imgs.forEach((img, idx) => {
          const parts = img.dataUrl.split(',');
          const match = parts[0].match(/:(.*?);/);
          const mimeType = match ? match[1] : 'image/jpeg';
          const base64Data = parts[1];
          if (base64Data && mimeType) {
            initialParts.push({
              text: `\n[Gambar Kategori: ${category}] -> Gunakan nilai ini untuk mapping: [Relative Index: ${idx}]`,
            } as Part);
            initialParts.push({ inlineData: { data: base64Data, mimeType } } as Part);
          }
        });
      };
      addImagesToContent(preTestImages, 'pre_test');
      addImagesToContent(implImages, 'implementasi');
      addImagesToContent(postTestImages, 'post_test');

      if (notebookImagesToAppend.length > 0) {
        initialParts.push({ text: `\n--- [NOTEBOOK VISUAL OUTPUTS (Charts/Graphs/Plots)] ---` } as Part);
        notebookImagesToAppend.forEach((img) => {
          initialParts.push({
            text: `Grafik/Gambar Output dari Notebook Index ${img.nbIdx}, Cell Index ${img.cellIdx}:`,
          } as Part);
          initialParts.push({
            inlineData: { data: img.base64.replace(/\s+/g, ''), mimeType: 'image/png' },
          } as Part);
        });
      }

      const contentsHistory: Content[] = [{ role: 'user', parts: initialParts }];
      const selectedModelId =
        AVAILABLE_MODELS.find((m) => m.name === selectedModelName)?.id || 'gemini-3.1-pro-preview';
      const activeDeclaration = isKuliah
        ? generateKuliahReportDeclaration
        : generateReportDeclaration;

      const callbacks = makeAgentCallbacks(setAiPreviewData);

      // Build the executor context. The notebook image bucket is the
      // base64 list we already extracted above so `inspect_image` with
      // category='notebook' has something to pull from.
      const notebookImagePool = notebookImagesToAppend.map((i) => ({
        dataUrl: `data:image/png;base64,${i.base64.replace(/\s+/g, '')}`,
      }));
      const ctx: ToolExecutionContext = {
        images: {
          pre_test: preTestImages,
          implementasi: implImages,
          post_test: postTestImages,
          notebook: notebookImagePool,
        },
        notebooks: combinedParsedNotebooks,
        aiData: EMPTY_AI_DATA,
      };

      const accumulatedAiData = await runAgent(apiKeyToUse, {
        modelId: selectedModelId,
        contents: contentsHistory,
        systemInstruction: GENERATION_SYSTEM_INSTRUCTION,
        declaration: activeDeclaration,
        maxLoops: copilotSettings.maxIterations,
        sysMsgBuilder: (loop) => buildBatchContinuationMessage(loop, totalImages),
        mode: 'append',
        initial: EMPTY_AI_DATA,
        ctx,
        declarationKey: isKuliah ? 'kuliah' : 'praktikum',
        callbacks,
      });

      setProgress(70);
      setStatusText('Menulis dan merapikan dokumen DOCX...');

      // Only emit the wrap-up message + DOCX build when the run reached
      // a natural terminator. Pause/Stop/Error paths exit early and the
      // caller's Continue / Retry handles re-entry. Read the synchronous
      // ref — the persisted session may still say 'running' for a few
      // microtask ticks after Stop because saveSession is deferred.
      if (runStateRef.current !== 'idle') {
        return;
      }

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'agent',
          text: 'Laporan berhasil di-generate secara struktural dan file DOCX telah dipersiapkan!',
        },
      ]);
      toast.success('Laporan berhasil di-generate!');
      setProgress(80);

      await buildAndSetDocx(
        metadata,
        combinedParsedNotebooks,
        accumulatedAiData,
        preTestImages,
        implImages,
        postTestImages,
        modulContext,
        postTest,
        parsedNotebooks.length,
        setGeneratedDocxBlob,
      );

      setProgress(100);
      setStatusText('Selesai!');

      if (sessionArg) {
        store.saveSession({
          ...sessionArg,
          title: metadata.judulPertemuan,
          aiData: accumulatedAiData,
        });
      }
    } catch (error: any) {
      // The error has already been surfaced via the `runAgent` catch
      // path; we just want to be sure the spinner state is cleared.
      console.error(error);
      toast.error('Gagal men-generate: ' + (error?.message ?? 'unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const compileEdit = async ({
    chatInput,
    setChatInput,
    aiPreviewData,
    setAiPreviewData,
    metadata,
    parsedNotebooks,
    postTestParsedNotebooks,
    preTestImages,
    implImages,
    postTestImages,
    modulContext,
    postTest,
    setGeneratedDocxBlob,
    session: sessionArg,
    store,
  }: any) => {
    if (isGenerating) return;
    if (!chatInput.trim() || !aiPreviewData) return;

    const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
    if (!apiKeyToUse) {
      toast.error('API Key Gemini belum diatur. Silakan tambahkan di pengaturan Word Options.');
      return;
    }

    const userMessage = chatInput;
    setChatInput('');

    // Selection-aware editing: if the user highlighted a portion of
    // the report preview before typing, scope the AI's edit to that
    // portion. Read + clear the slice so the next message defaults to
    // a full-report edit unless the user re-selects.
    const storeState = useAppStore.getState();
    const selection = storeState.selectionContext;
    if (selection) {
      storeState.setSelectionContext(null);
    }

    // Snapshot the pre-instruction state so the per-message ↶ undo
    // arrow can roll back. Mint the message id ourselves so the
    // checkpoint can be associated with it.
    const messageId = generateId();
    const checkpointId = snapshotBeforeUserMessage(userMessage);
    setChatHistory((prev) => [
      ...prev,
      {
        role: 'user',
        text: userMessage,
        id: messageId,
        precedingCheckpointId: checkpointId,
      },
    ]);

    setIsGenerating(true);
    setStatusText('Menganalisis permintaan instruksi edit...');

    try {
      // When the user highlighted text, prepend a CONTEXT block so the
      // agent treats the selection as the focus of the edit. The raw
      // prompt path is preserved for the unselected case so existing
      // behavior is unchanged.
      const promptUserMessage = selection
        ? `[CONTEXT — selected text${selection.field ? ` from "${selection.field}"` : ''}]:\n"""\n${selection.text}\n"""\n\nUser request: ${userMessage}\n\nIMPORTANT: Modify ONLY the selected portion if possible. Keep the rest of the report unchanged.`
        : userMessage;

      const prompt = buildEditPrompt({
        judulLaporan: sessionArg?.metadata?.judulPertemuan || '',
        currentDataJson: JSON.stringify(aiPreviewData, null, 2),
        userMessage: promptUserMessage,
      });

      const selectedModelId =
        AVAILABLE_MODELS.find((m) => m.name === selectedModelName)?.id || 'gemini-3.1-pro-preview';
      const isKuliah = sessionArg && sessionArg.metadata?.reportType === 'kuliah';
      const activeDeclaration = isKuliah ? generateKuliahReportDeclaration : generateReportDeclaration;
      const contentsHistory: Content[] = [{ role: 'user', parts: [{ text: prompt } as Part] }];
      const callbacks = makeAgentCallbacks(setAiPreviewData);

      const ctx: ToolExecutionContext = {
        images: {
          pre_test: preTestImages,
          implementasi: implImages,
          post_test: postTestImages,
          notebook: [],
        },
        notebooks: [...parsedNotebooks, ...postTestParsedNotebooks],
        aiData: aiPreviewData,
      };

      const accumulatedAiData = await runAgent(apiKeyToUse, {
        modelId: selectedModelId,
        contents: contentsHistory,
        systemInstruction: EDIT_SYSTEM_INSTRUCTION,
        declaration: activeDeclaration,
        maxLoops: 3,
        sysMsgBuilder: () => 'If you are done editing, reply with text. Otherwise, keep calling.',
        mode: 'replace',
        initial: aiPreviewData,
        ctx,
        declarationKey: isKuliah ? 'kuliah' : 'praktikum',
        callbacks,
      });

      setStatusText('Menulis dan merapikan dokumen DOCX...');
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'agent',
          text: 'Struktur laporan telah berhasil diperbarui sesuai dengan instruksi yang diberikan.',
        },
      ]);

      const combinedParsedNotebooks = [...parsedNotebooks, ...postTestParsedNotebooks];
      await buildAndSetDocx(
        metadata,
        combinedParsedNotebooks,
        accumulatedAiData,
        preTestImages,
        implImages,
        postTestImages,
        modulContext,
        postTest,
        parsedNotebooks.length,
        setGeneratedDocxBlob,
      );
      setStatusText('Selesai!');

      if (sessionArg) {
        store.saveSession({
          ...sessionArg,
          title: metadata.judulPertemuan,
          aiData: accumulatedAiData,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal mengedit: ' + (error?.message ?? 'unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    progress,
    statusText,
    chatHistory,
    setChatHistory,
    selectedModelName,
    setSelectedModelName,
    generateReport,
    compileEdit,
    // Run state surface (Phase A/B/C)
    runState,
    iteration,
    maxLoops,
    currentTool,
    taskPlan,
    retryStatus,
    pause,
    stop,
    continueRun,
    // Checkpoint surface (Req 4)
    saveManualCheckpoint,
    revertToCheckpointById,
    checkpoints,
    /** Undo back to the state right before a specific user message ran. */
    undoToMessage,
    // PendingMerge surface (Req 5)
    pendingMerge,
    acceptHunk,
    rejectHunk,
    acceptAllHunks,
    rejectAllHunks,
    // Clarification / steer (Req 6.4 / 11)
    submitClarification,
    pendingClarification: session?.pendingClarification ?? null,
    // New-chat reset action wired to the panel header `+` button.
    clearChat,
    // Per-report archived chat threads + open / delete actions.
    chatThreads,
    openThread,
    deleteThread,
  };
}

function defaultCtx(aiData: AIReportData): ToolExecutionContext {
  return {
    images: { pre_test: [], implementasi: [], post_test: [], notebook: [] },
    notebooks: [],
    aiData,
  };
}
