import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  SendHorizonal,
  CheckCircle2,
  Loader2,
  Cpu,
  ChevronDown,
  ChevronRight,
  Code,
  Info,
  User,
  Terminal,
  HelpCircle,
  Square,
  XCircle,
  Ban,
  Plus,
  History,
  MoreHorizontal,
  X,
  Trash2,
  BookmarkPlus,
  Undo2,
  Quote,
} from 'lucide-react';
import { AIReportData } from '@/lib/types';
import type { CopilotMessage, ToolCallState } from '@/hooks/use-copilot-ai';
import type {
  RunState,
  TaskPlan,
  Checkpoint,
  PendingMerge,
  ChatThread,
} from '@/lib/copilot/types';
import { ActiveTaskPanel } from '@/components/copilot/active-task-panel';
import { DiffView } from '@/components/copilot/diff-view';
import { CheckpointTimeline } from '@/components/copilot/checkpoint-timeline';
import { ChatHistory } from '@/components/copilot/chat-history';
import { TaskPlanCard } from '@/components/copilot/task-plan-card';

/* ---------------------------------------------------------------------------
   Tool call block: flat, full-width, bordered. Like an IDE call-stack frame.
--------------------------------------------------------------------------- */
const ToolCallViewer = ({ tool }: { tool: ToolCallState }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col border border-[#1F1F1F] bg-[#0A0A0A] w-full rounded-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 h-8 hover:bg-[#111111] transition-colors outline-none w-full text-left"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {tool.status === 'running' ? (
            <Loader2 className="w-3 h-3 text-[#2F81F7] animate-spin shrink-0" />
          ) : tool.status === 'cancelled' ? (
            <Ban className="w-3 h-3 text-[#6E6E6E] shrink-0" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-[#2EA043] shrink-0" />
          )}
          <Code className="w-3 h-3 text-[#6E6E6E] shrink-0" />
          <span className="text-[11px] truncate">
            <span className="text-[#6E6E6E] mr-1">Tool</span>
            <span className="text-[#2F81F7] font-medium font-mono">{tool.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#6E6E6E]">
            {tool.status === 'running'
              ? 'Running'
              : tool.status === 'cancelled'
                ? 'Cancelled'
                : 'Completed'}
          </span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-[#6E6E6E]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#6E6E6E]" />
          )}
        </div>
      </button>

      {expanded && tool.args && (
        <div className="border-t border-[#1F1F1F] bg-[#050505]">
          <pre className="text-[11px] font-mono text-[#A1A1A1] overflow-x-auto whitespace-pre-wrap max-h-[300px] custom-scrollbar p-3 leading-relaxed">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const AgentMessage = ({ msg, statusText }: { msg: CopilotMessage; statusText: string }) => {
  const [showThought, setShowThought] = useState(msg.isThinking);
  const thoughtEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msg.isThinking) setShowThought(true);
    else if (!msg.isThinking && msg.thought) setShowThought(false);
  }, [msg.isThinking, msg.thought]);

  useEffect(() => {
    if (showThought && thoughtEndRef.current) {
      thoughtEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [msg.thought, showThought]);

  const showThoughtBox = msg.thought || msg.isThinking;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2 h-5">
        <div className="w-4 h-4 flex items-center justify-center bg-[#0F1A2E] border border-[#1F3A66] rounded-sm">
          <Sparkles className="w-2.5 h-2.5 text-[#2F81F7]" />
        </div>
        <span className="text-[11px] font-medium text-[#EDEDED]">Copilot</span>
        {msg.isThinking && (
          <span className="text-[11px] text-[#6E6E6E] pl-2 border-l border-[#1F1F1F] ml-1">
            Thinking
          </span>
        )}
      </div>

      {showThoughtBox && (
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] rounded-sm overflow-hidden">
          <button
            onClick={() => setShowThought(!showThought)}
            className="flex items-center justify-between px-3 h-7 w-full hover:bg-[#111111] transition-colors outline-none"
          >
            <div className="flex items-center gap-2">
              {msg.isThinking ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#2F81F7]" />
              ) : (
                <Cpu className="w-3 h-3 text-[#6E6E6E]" />
              )}
              <span
                className={`text-[11px] ${
                  msg.isThinking ? 'text-[#2F81F7] font-medium' : 'text-[#A1A1A1]'
                }`}
              >
                {msg.isThinking ? statusText || 'Analyzing context' : 'Reasoning'}
              </span>
            </div>
            {showThought ? (
              <ChevronDown className="w-3 h-3 text-[#6E6E6E]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#6E6E6E]" />
            )}
          </button>

          {showThought && (
            <div className="border-t border-[#1F1F1F] bg-[#050505]">
              <div className="px-3 py-2.5 font-mono text-[11px] text-[#A1A1A1] whitespace-pre-wrap leading-[1.55] max-h-[300px] overflow-y-auto custom-scrollbar">
                {msg.thought ? (
                  msg.thought
                ) : (
                  <span className="text-[#6E6E6E] animate-pulse">
                    Waiting for model output…
                  </span>
                )}
                <div ref={thoughtEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {msg.tools && msg.tools.length > 0 && (
        <div className="flex flex-col gap-1 w-full">
          {msg.tools.map((tool, idx) => (
            <ToolCallViewer key={idx} tool={tool} />
          ))}
        </div>
      )}

      {msg.text && (
        <div className="border-l-2 border-[#2F81F7] pl-3 pr-1 py-1 text-[13px] leading-relaxed text-[#EDEDED] whitespace-pre-wrap">
          {msg.text}
        </div>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------- */

interface CopilotPanelProps {
  chatHistory: CopilotMessage[];
  isGenerating: boolean;
  statusText: string;
  selectedModelName: string;
  setSelectedModelName: (val: string) => void;
  availableModels: any[];
  handleGenerate: () => void;
  aiPreviewData: AIReportData | null;
  chatInput: string;
  setChatInput: (val: string) => void;
  handleCompileEdit: () => void;

  // Header (Antigravity-style: title + + + history + ⋯ + ✕)
  sessionTitle: string;
  onNewChat: () => void;
  onClose: () => void;

  // Run controls (Phase A/B)
  runState: RunState;
  iteration: number;
  maxLoops: number;
  currentTool: ToolCallState | null;
  retryStatus: { attempt: number; total: number; delayMs: number } | null;
  taskPlan: TaskPlan | null;
  pause: () => void;
  stop: () => void;
  continueRun: () => void;
  saveManualCheckpoint: (label?: string) => void;
  // Checkpoint surface (Req 4)
  checkpoints: Checkpoint[];
  revertToCheckpointById: (id: string) => void;
  undoToMessage: (messageId: string) => void;

  // Chat history (per-report archived threads — Cursor-style)
  chatThreads: ChatThread[];
  onOpenThread: (id: string) => void;
  onDeleteThread: (id: string) => void;

  // PendingMerge surface (Req 5)
  pendingMerge: PendingMerge | null;
  acceptHunk: (id: string) => void;
  rejectHunk: (id: string) => void;
  acceptAllHunks: () => void;
  rejectAllHunks: () => void;

  // Clarification (Req 6.4 / 11)
  pendingClarification: { question: string; askedAt: number } | null;
  submitClarification: (text: string) => { ok: boolean; reason?: string };
}

export function CopilotPanel(props: CopilotPanelProps) {
  const {
    chatHistory,
    isGenerating,
    statusText,
    selectedModelName,
    setSelectedModelName,
    availableModels,
    handleGenerate,
    aiPreviewData,
    chatInput,
    setChatInput,
    handleCompileEdit,
    sessionTitle,
    onNewChat,
    onClose,
    runState,
    iteration,
    maxLoops,
    currentTool,
    retryStatus,
    taskPlan,
    pause,
    stop,
    continueRun,
    saveManualCheckpoint,
    checkpoints,
    revertToCheckpointById,
    undoToMessage,
    chatThreads,
    onOpenThread,
    onDeleteThread,
    pendingMerge,
    acceptHunk,
    rejectHunk,
    acceptAllHunks,
    rejectAllHunks,
    pendingClarification,
    submitClarification,
  } = props;

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Drawer + diff modal local state.
  // History (🕘 icon) lists past chat sessions; checkpoints live under
  // the More menu so users can still revert structural snapshots
  // without that drawer hijacking the dedicated history affordance.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checkpointsOpen, setCheckpointsOpen] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<'pending' | 'readonly' | 'hidden'>('hidden');
  const [readonlyDiff, setReadonlyDiff] = useState<PendingMerge | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Selection-aware editing chip — driven by a transient store slice
  // written by the report preview's `mouseup` handler.
  const selectionContext = useAppStore((s) => s.selectionContext);
  const setSelectionContext = useAppStore((s) => s.setSelectionContext);

  // Identify the LAST user message id so the per-message undo arrow
  // suppresses itself there (no point undoing the most recent
  // instruction — the user can just type a follow-up).
  const lastUserMessageId = (() => {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const m = chatHistory[i];
      if (m.role === 'user') return m.id;
    }
    return undefined;
  })();

  // Composer error (Req 11.2 inline-error path).
  const [composerError, setComposerError] = useState<string | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isGenerating, statusText]);

  // Auto-show the diff modal when a pendingMerge appears.
  useEffect(() => {
    if (pendingMerge) {
      setDiffViewMode('pending');
    } else if (diffViewMode === 'pending') {
      setDiffViewMode('hidden');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMerge?.id, pendingMerge?.hunks.length]);

  const composerDisabled = !!pendingClarification ? false : isGenerating && runState !== 'running';
  const placeholder = pendingClarification
    ? 'Reply to the agent…'
    : aiPreviewData
      ? 'Ask Copilot to edit specific parts…'
      : 'Generate a report first to edit…';

  /**
   * Submit handler — dispatches between three modes:
   *   1. `pendingClarification` set → resolve via submitClarification + continue
   *   2. running with composer message → queue as steer + pause
   *   3. idle / paused / error → defer to generate or compileEdit
   */
  const handleSubmit = () => {
    setComposerError(null);
    if (pendingClarification) {
      const result = submitClarification(chatInput);
      if (!result.ok) {
        setComposerError(result.reason ?? 'Invalid message.');
        return;
      }
      setChatInput('');
      // Resume the loop with the queued steer.
      continueRun();
      return;
    }
    if (runState === 'running' && chatInput.trim()) {
      const result = submitClarification(chatInput);
      if (!result.ok) {
        setComposerError(result.reason ?? 'Invalid message.');
        return;
      }
      setChatInput('');
      pause();
      return;
    }
    if (aiPreviewData) handleCompileEdit();
    else handleGenerate();
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] overflow-hidden relative">
      {/* ================= HEADER ================= */}
      {/* Antigravity-style: title (truncated) + actions row.
          Sits above the Active Task Panel and chat thread. The actions
          mirror what users expect from a chat surface — New chat (+),
          History (clock icon → checkpoint timeline drawer), overflow
          menu (Save checkpoint, Clear chat), and a Close (✕). */}
      <div className="shrink-0 h-9 flex items-center gap-1 pl-3 pr-1 border-b border-[#1F1F1F] bg-[#0A0A0A] select-none">
        <span
          className="flex-1 text-[12px] font-medium text-[#EDEDED] truncate"
          title={sessionTitle}
        >
          {sessionTitle || 'Copilot'}
        </span>

        <button
          type="button"
          onClick={() => {
            // Confirm if there's actual chat to lose. Welcome-only is a
            // no-op so we skip the prompt for a cleaner UX.
            const hasContent = chatHistory.some(
              (m) => m.role !== 'agent' || (m.text && m.text !== chatHistory[0]?.text),
            );
            if (hasContent && !window.confirm('Start a new chat? This clears the current thread.')) {
              return;
            }
            onNewChat();
          }}
          title="New chat"
          className="w-7 h-7 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] rounded-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="sr-only">New chat</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setHistoryOpen((v) => !v);
            setCheckpointsOpen(false);
          }}
          title={historyOpen ? 'Hide chat history' : 'Show chat history'}
          className={`w-7 h-7 flex items-center justify-center rounded-sm ${
            historyOpen
              ? 'text-[#2F81F7] bg-[#0F1A2E]'
              : 'text-[#A1A1A1] hover:text-white hover:bg-[#161616]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span className="sr-only">History</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreMenuOpen((v) => !v)}
            title="More actions"
            className={`w-7 h-7 flex items-center justify-center rounded-sm ${
              moreMenuOpen
                ? 'bg-[#161616] text-white'
                : 'text-[#A1A1A1] hover:text-white hover:bg-[#161616]'
            }`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="sr-only">More</span>
          </button>
          {moreMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-1 w-52 bg-[#111111] border border-[#222222] rounded-sm py-1 z-40">
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    saveManualCheckpoint();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none text-left"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-[#A1A1A1]" />
                  <span className="flex-1">Save checkpoint</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setCheckpointsOpen((v) => !v);
                    setHistoryOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none text-left"
                >
                  <History className="w-3.5 h-3.5 text-[#A1A1A1]" />
                  <span className="flex-1">Open checkpoints</span>
                </button>
                <div className="my-1 border-t border-[#1F1F1F]" />
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    if (window.confirm('Clear the current chat thread?')) onNewChat();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#F85149] hover:bg-[#1A0808] outline-none text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="flex-1">Clear chat</span>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close panel"
          className="w-7 h-7 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] rounded-sm"
        >
          <X className="w-3.5 h-3.5" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      {/* ================= ACTIVE TASK PANEL ================= */}
      <ActiveTaskPanel
        runState={runState}
        iteration={iteration}
        maxLoops={maxLoops}
        currentTool={currentTool}
        retryStatus={retryStatus}
        subStatus={null}
        taskPlan={taskPlan}
        onPause={runState === 'running' ? pause : undefined}
        onContinue={runState === 'paused' || runState === 'error' ? continueRun : undefined}
        onStop={undefined}
        onSaveCheckpoint={runState !== 'idle' ? () => saveManualCheckpoint() : undefined}
        onOpenCheckpoints={() => {
          setCheckpointsOpen((v) => !v);
          setHistoryOpen(false);
        }}
      />

      {/* ================= THREAD ================= */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar scroll-smooth"
        >
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-10 h-10 flex items-center justify-center border border-[#1F1F1F] mb-4 rounded-sm">
                <Terminal className="w-4 h-4 text-[#4A4A4A]" />
              </div>
              <p className="text-[12px] text-[#EDEDED] font-medium">Copilot is ready</p>
              <p className="text-[11px] text-[#6E6E6E] mt-1 max-w-[260px]">
                Generate a report or send a message to start the conversation.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1A1A1A]">
              {chatHistory.map((m, i) => {
                const k = m.id ?? `${m.role}-${i}`;
                if (m.role === 'user') {
                  const canUndo =
                    !!m.precedingCheckpointId && m.id !== lastUserMessageId;
                  return (
                    <div key={k} className="px-4 py-3 hover:bg-[#0C0C0C] transition-colors group/usermsg relative">
                      <div className="flex items-center gap-2 h-5 mb-1.5">
                        <div className="w-4 h-4 flex items-center justify-center bg-[#161616] border border-[#2A2A2A] rounded-sm">
                          <User className="w-2.5 h-2.5 text-[#A1A1A1]" />
                        </div>
                        <span className="text-[11px] font-medium text-[#EDEDED]">You</span>
                      </div>
                      <div className="pl-6 text-[13px] leading-relaxed text-[#EDEDED] whitespace-pre-wrap">
                        {m.text}
                      </div>
                      {canUndo && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Undo changes up to this point? Later messages will be removed.',
                              )
                            ) {
                              undoToMessage(m.id!);
                            }
                          }}
                          title="Undo changes up to this point"
                          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-[#6E6E6E] hover:text-[#2F81F7] hover:bg-[#0F1A2E] rounded-sm opacity-0 group-hover/usermsg:opacity-100 transition-opacity"
                        >
                          <Undo2 className="w-3 h-3" />
                          <span className="sr-only">Undo to this point</span>
                        </button>
                      )}
                    </div>
                  );
                }

                if (m.role === 'system') {
                  // Style clarification system messages distinctly.
                  const isQuestion = m.text.startsWith('❓');
                  return (
                    <div
                      key={k}
                      className={`px-4 py-2.5 flex items-start gap-2 text-[11px] ${
                        isQuestion
                          ? 'bg-[#1A1208] text-[#D29922]'
                          : 'bg-[#0C0C0C] text-[#A1A1A1]'
                      }`}
                    >
                      {isQuestion ? (
                        <HelpCircle className="w-3 h-3 text-[#D29922] shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-3 h-3 text-[#6E6E6E] shrink-0 mt-0.5" />
                      )}
                      <span className="leading-relaxed break-words">{m.text}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={k}
                    data-role="agent-msg"
                    className="px-4 py-3 hover:bg-[#0C0C0C] transition-colors"
                  >
                    <AgentMessage msg={m} statusText={statusText} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History drawer (per-report chat threads). */}
        {historyOpen && (
          <ChatHistory
            threads={chatThreads}
            onOpenThread={(id) => {
              onOpenThread(id);
              setHistoryOpen(false);
            }}
            onDeleteThread={onDeleteThread}
            onClose={() => setHistoryOpen(false)}
          />
        )}

        {/* Checkpoint timeline drawer (Req 4 / 19.2) */}
        {checkpointsOpen && (
          <CheckpointTimeline
            checkpoints={checkpoints}
            onView={(id) => {
              const cp = checkpoints.find((c) => c.id === id);
              if (!cp) return;
              // Build a synthetic PendingMerge for read-only viewing —
              // base = current aiData would be ideal but we don't have it
              // here; the drawer shows the snapshot as the "merged"
              // side and the current accumulated as the base. The diff
              // engine handles either order.
              setReadonlyDiff({
                id: `cp-${cp.id}`,
                createdAt: cp.createdAt,
                baseSnapshot: cp.aiDataSnapshot,
                mergedSnapshot: cp.aiDataSnapshot,
                hunks: [],
                iterationIndex: 0,
              });
              setDiffViewMode('readonly');
            }}
            onRevert={revertToCheckpointById}
            onClose={() => setCheckpointsOpen(false)}
          />
        )}
      </div>

      {/* Diff view modal (Req 5 / 18.2) */}
      {diffViewMode === 'pending' && pendingMerge && (
        <DiffView
          pending={pendingMerge}
          mode="pending"
          onAccept={acceptHunk}
          onReject={rejectHunk}
          onAcceptAll={acceptAllHunks}
          onRejectAll={rejectAllHunks}
          onClose={() => setDiffViewMode('hidden')}
        />
      )}
      {diffViewMode === 'readonly' && readonlyDiff && (
        <DiffView
          pending={readonlyDiff}
          mode="readonly"
          onClose={() => {
            setDiffViewMode('hidden');
            setReadonlyDiff(null);
          }}
        />
      )}

      {/* Task plan card — chat-anchored, collapsible. Sits between the
          chat thread and the composer so it's where the user's eyes
          already are after sending a message (Req 10.7). */}
      <TaskPlanCard
        taskPlan={taskPlan}
        runState={runState}
        onJumpToStep={(_id, title) => {
          // Best-effort scroll: find the latest agent message that
          // contains the step title as a substring (Req 10.11).
          if (!chatContainerRef.current) return;
          const root = chatContainerRef.current;
          const candidates = Array.from(
            root.querySelectorAll<HTMLDivElement>('[data-role="agent-msg"]'),
          );
          const needle = title.toLowerCase();
          const match = [...candidates].reverse().find((el) =>
            (el.textContent ?? '').toLowerCase().includes(needle),
          );
          if (match) match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />

      {/* ================= COMPOSER ================= */}
      <div className="shrink-0 border-t border-[#1F1F1F] bg-[#0A0A0A]">
        <div className="h-7 flex items-center justify-between px-3 border-b border-[#1F1F1F] bg-[#0A0A0A]">
          <Select value={selectedModelName} onValueChange={(v) => v && setSelectedModelName(v)}>
            <SelectTrigger className="h-6 bg-transparent border-none shadow-none focus:ring-0 focus:border-none focus-visible:ring-0 focus-visible:border-none px-1 text-[10px] font-mono text-[#A1A1A1] hover:text-white gap-1 rounded-sm">
              <Sparkles className="w-2.5 h-2.5 text-[#2F81F7] shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0F0F0F] border border-[#1F1F1F] text-[#EDEDED] min-w-[260px] rounded-sm p-0 shadow-none">
              <div className="px-3 py-1.5 text-[9px] font-medium tracking-[0.14em] text-[#6E6E6E] uppercase border-b border-[#1F1F1F]">
                Model selection
              </div>
              {availableModels.map((m) => (
                <SelectItem
                  key={m.name}
                  value={m.name}
                  className="focus:bg-[#161616] focus:text-white cursor-pointer px-3 py-2 text-[11px] rounded-none mx-0 my-0 border-b border-[#141414] last:border-0 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 w-full">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{m.name}</span>
                      {m.new && (
                        <span className="font-mono text-[8px] tracking-[0.14em] uppercase border border-[#1F3A66] bg-[#0F1A2E] text-[#2F81F7] px-1">
                          new
                        </span>
                      )}
                    </div>
                    {m.info && <div className="text-[10px] text-[#6E6E6E] font-mono">{m.info}</div>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="flex items-center gap-1.5 text-[11px] text-[#A1A1A1]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isGenerating ? 'bg-[#D29922] animate-pulse' : 'bg-[#2EA043]'
              }`}
            />
            {isGenerating ? 'Generating' : 'Ready'}
          </span>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full h-9 flex items-center justify-center gap-2 bg-[#2F81F7] hover:bg-[#2563EB] disabled:bg-[#161616] disabled:text-[#4A4A4A] disabled:cursor-not-allowed text-white font-medium transition-colors rounded-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[12px] tracking-wide uppercase">
              {aiPreviewData ? 'Regenerate Analysis' : 'Generate Initial Report'}
            </span>
          </button>
        </div>

        <div className="p-3 pt-2">
          {selectionContext && (
            <div className="mb-2 flex items-start gap-2 px-2.5 py-1.5 bg-[#0F1A2E] border border-[#1F3A66] rounded-sm">
              <Quote className="w-3 h-3 text-[#2F81F7] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {selectionContext.field && (
                  <div className="text-[10px] font-medium text-[#2F81F7] uppercase tracking-wide truncate">
                    {selectionContext.field}
                  </div>
                )}
                <div className="text-[11px] text-[#A1A1A1] truncate italic">
                  &ldquo;{selectionContext.text.length > 100 ? selectionContext.text.slice(0, 100) + '…' : selectionContext.text}&rdquo;
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectionContext(null)}
                title="Clear selection context"
                className="w-5 h-5 flex items-center justify-center text-[#6E6E6E] hover:text-white hover:bg-[#161616] rounded-sm shrink-0"
              >
                <X className="w-3 h-3" />
                <span className="sr-only">Clear</span>
              </button>
            </div>
          )}
          <div className="relative border border-[#1F1F1F] focus-within:border-[#2F81F7] bg-[#0A0A0A] rounded-sm transition-colors">
            <div className="flex items-center h-6 px-2.5 border-b border-[#1F1F1F] bg-[#0C0C0C]">
              <span className="text-[10px] font-medium text-[#A1A1A1]">
                {pendingClarification
                  ? 'Reply to clarification'
                  : runState === 'running'
                    ? 'Steer the agent'
                    : aiPreviewData
                      ? 'Edit instructions'
                      : 'Message Copilot'}
              </span>
              <span className="ml-auto text-[10px] text-[#6E6E6E]">
                ⏎ to send · ⇧⏎ for newline
              </span>
            </div>
            <Textarea
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
                if (composerError) setComposerError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={placeholder}
              disabled={composerDisabled}
              className="resize-none min-h-[72px] max-h-[180px] bg-transparent border-none text-[#EDEDED] focus-visible:ring-0 focus-visible:border-none rounded-none pl-3 pr-11 py-2.5 text-[13px] leading-relaxed transition-all custom-scrollbar placeholder:text-[#4A4A4A]"
            />
            {runState === 'running' ? (
              // Cursor-style red Stop square — morphs from the Send button
              // while the agent is running so the action sits where the
              // user's hand is, not in the panel header.
              <button
                onClick={stop}
                title="Stop the agent (cursor preserved for Pause; Stop clears it)"
                className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-[#F85149] hover:bg-[#DA3633] text-white transition-colors rounded-full"
              >
                <Square className="w-3 h-3 fill-white" />
                <span className="sr-only">Stop</span>
              </button>
            ) : runState === 'error' ? (
              // Error state — clicking Stop clears the cursor explicitly,
              // matching the cursor X behavior of typical agent UIs.
              <button
                onClick={stop}
                title="Dismiss error"
                className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-[#F85149] hover:bg-[#DA3633] text-white transition-colors rounded-sm"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span className="sr-only">Dismiss</span>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={composerDisabled || !chatInput.trim()}
                title="Send"
                className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-[#2F81F7] hover:bg-[#2563EB] disabled:bg-[#161616] disabled:text-[#4A4A4A] disabled:cursor-not-allowed text-white transition-colors rounded-sm"
              >
                <SendHorizonal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {composerError && (
            <div className="mt-1.5 text-[11px] text-[#F85149]">{composerError}</div>
          )}
          {runState === 'paused' && !pendingClarification && (
            <div className="mt-1.5 text-[11px] text-[#D29922]">
              Will steer agent on Continue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
