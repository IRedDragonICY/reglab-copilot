import { GoogleGenAI, FunctionCallingConfigMode, Content, Part } from '@google/genai';
import type { AIReportData } from '@/lib/types';
import type {
  LoopCursor,
  PendingMerge,
  PendingTool,
  TaskPlanStep,
  TaskStatus,
} from '@/lib/copilot/types';
import { mergeReportData, type MergeMode } from './merge';
import { withQuotaRetry, isQuotaError } from './tools/retry';
import {
  TOOL_REGISTRY,
  type ToolDeclaration,
  type ToolExecutionContext,
} from './tools';
import { applyGranularMerge } from './tools/granular-merge';
import { computeDiff } from '@/lib/copilot/diff-engine';

/**
 * Agentic multi-turn streaming loop for the Copilot Generate / Edit flows.
 *
 * Phase A baseline:
 *   - Streamed thought / text / tool deltas (`extractDeltas`)
 *   - `withQuotaRetry` wrapping every SDK call
 *   - `signal` for Pause/Stop at safe boundaries
 *   - `resumeCursor` for picking up a previously-paused run
 *   - `onLoopCursorUpdate` snapshots before each iteration and after each merge
 *   - `onCheckpointRequest` after every authoritative merge (Req 4.1, 4.6)
 *
 * Phase B additions (tasks 11.1, 11.2, 12.1, 13.1):
 *   - Optional `extraTools`: granular / meta / inspection declarations are
 *     appended to the SDK `tools[].functionDeclarations` array alongside the
 *     legacy primary `declaration` (Req 6.1, 6.8 — additive only).
 *   - Multi-tool turn handling: every `functionCall` in the streamed
 *     response is collected and dispatched in declaration order. The agent
 *     emits one `functionResponse` per call in the same order so Gemini 3's
 *     thought-signature contract is preserved.
 *   - Optional `enableGoogleSearch` / `enableCodeExecution` add Gemini's
 *     built-in tools to the same `tools[]` array (Req 6.6, 6.7).
 *   - Optional `pendingUserSteer`: a queued user message injected as a
 *     fresh user turn before the next iteration (Req 11.3).
 *   - New callbacks: `onTaskPlan`, `onTaskStatus`, `onClarification`,
 *     `onTaskComplete`, `onPendingMerge`, `onCitations`, `onCodeExecution`.
 *
 * Phase C addition (task 17.1):
 *   - Optional `autoAccept`: when `false` and a merge would have applied,
 *     the loop stashes the merged state as a `PendingMerge` via
 *     `onPendingMerge` and returns the unmodified `accumulated` so the UI
 *     can surface a diff view. The cursor is preserved so Continue
 *     (after the user accepts/rejects) resumes from the next iteration.
 *
 * Legacy callers that omit every new field MUST observe identical
 * behavior to today (Req 9.5). The added behaviors are gated behind the
 * presence of the corresponding optional fields.
 */

export interface ToolCallState {
  name: string;
  status: 'running' | 'completed' | 'cancelled';
  args?: unknown;
}

export interface CopilotMessage {
  role: 'user' | 'agent' | 'system';
  text: string;
  isThinking?: boolean;
  thought?: string;
  tools?: ToolCallState[];
  id?: string;
  /**
   * For `role: 'user'` messages: id of the checkpoint snapshotted right
   * BEFORE this instruction ran. Used by the per-message undo arrow
   * (Cursor-style "↶ Undo changes up to this point") so the user can
   * roll the report back to the state that existed before they sent
   * this turn.
   */
  precedingCheckpointId?: string;
  /**
   * For `role: 'system'` messages: when this is `'checkpoint'`, the
   * message is rendered as a `── Checkpoint ──` separator instead of
   * the standard info row.
   */
  systemKind?: 'info' | 'question' | 'checkpoint';
}

/**
 * Citation chunk surfaced from Gemini's `googleSearch` grounding tool.
 * Shape mirrors the API's `groundingChunks[]` entries; only the fields
 * the UI consumes are typed.
 */
export interface GroundingChunk {
  uri?: string;
  title?: string;
  snippet?: string;
}

/**
 * Code-execution block surfaced from Gemini's built-in `codeExecution`
 * tool. We keep the interface minimal — the UI renders the code +
 * stdout/stderr verbatim and the SDK's exact shape is still in flux.
 */
export interface CodeExecutionBlock {
  language?: string;
  code: string;
  output?: string;
}

export interface AgentLoopCallbacks {
  /** Called each time the agent's "thought" stream grows. */
  onThought?: (thoughtSoFar: string) => void;
  /** Called each time plain text (non-function-call) grows. */
  onText?: (textSoFar: string) => void;
  /** Called when the active tool-call list changes (new tool or new args). */
  onToolUpdate?: (tools: ToolCallState[]) => void;
  /** Streaming-time preview of the merged data (mode: 'preview' or 'replace'). */
  onPreviewMerge?: (next: AIReportData) => void;
  /** Called at the end of each loop iteration with the authoritative merge. */
  onMergeComplete?: (next: AIReportData, loopIndex: number) => void;
  /** Called once per iteration with a human-readable status string. */
  onStatus?: (status: string) => void;
  /** Called at the start of each iteration — returns the id to tag the new agent message. */
  onIterationStart?: (loopIndex: number) => string;
  /** Called when an iteration's agent message finishes streaming. */
  onIterationEnd?: (msgId: string, finalTools: ToolCallState[]) => void;
  /** Called after a successful tool-call merge to inject a system message. */
  onSystemMessage?: (text: string) => void;

  /**
   * Fired immediately after every authoritative `onMergeComplete` so the
   * hook layer can mint a Checkpoint (Req 4.1). Crucially, this is NOT
   * fired for `onPreviewMerge` — only the authoritative merge path
   * triggers auto-checkpoints (Req 4.6). Optional and additive: legacy
   * callers that omit it observe identical behavior.
   */
  onCheckpointRequest?: (snapshot: { aiData: AIReportData; loopIndex: number }) => void;

  /**
   * Fired at safe boundaries (top of each iteration after `loopIndex++`,
   * and after each authoritative merge) with a fresh `LoopCursor` snapshot.
   * Consumers persist the cursor so a tab close / reload can be resumed.
   */
  onLoopCursorUpdate?: (cursor: LoopCursor) => void;

  /**
   * Forwarded from `withQuotaRetry`'s `onAttempt`. Fires before each retry
   * sleep with the upcoming attempt number and delay in ms.
   */
  onRetryAttempt?: (attempt: number, delayMs: number) => void;

  // ---------------------------------------------------------------------------
  // Phase B / C additions — all optional, no-op for legacy callers.
  // ---------------------------------------------------------------------------
  /** Agent declared a new task plan via `set_task_plan`. */
  onTaskPlan?: (steps: TaskPlanStep[]) => void;
  /** Agent updated one step's status via `update_task_status`. */
  onTaskStatus?: (id: string, status: TaskStatus) => void;
  /** Agent requested a user clarification. The loop pauses after this fires. */
  onClarification?: (question: string) => void;
  /** Agent called `mark_task_complete`. The loop terminates after this fires. */
  onTaskComplete?: (summary?: string) => void;
  /** Agent surfaced a pending merge (auto-accept OFF only). Loop returns. */
  onPendingMerge?: (pending: PendingMerge) => void;
  /** Citations from `googleSearch` grounding. */
  onCitations?: (chunks: GroundingChunk[]) => void;
  /** Code execution blocks from the built-in sandbox. */
  onCodeExecution?: (block: CodeExecutionBlock) => void;
}

export interface ExtraToolBundle {
  /** Granular / meta / inspection declarations to append to `tools[].functionDeclarations`. */
  declarations: ToolDeclaration[];
}

export interface AgentLoopArgs {
  apiKey: string;
  modelId: string;
  /** Mutated in-place to extend the conversation history across iterations. */
  contents: Content[];
  systemInstruction: string;
  declaration: unknown;
  maxLoops: number;
  /** Builds the "continue batch" message after each successful tool call. */
  sysMsgBuilder: (loopIndex: number) => string;
  mode: Extract<MergeMode, 'append' | 'replace'>;
  initial: AIReportData;
  callbacks: AgentLoopCallbacks;

  // Phase A optional fields.
  signal?: AbortSignal;
  resumeCursor?: LoopCursor;
  retryConfig?: { schedule?: readonly number[] };

  // ---------------------------------------------------------------------------
  // Phase B / C optional fields.
  // ---------------------------------------------------------------------------
  /** Extra granular / meta / inspection declarations registered with the SDK. */
  extraTools?: ExtraToolBundle;
  /**
   * Read-only context handed to executors that need access to images or
   * notebooks (`inspect_image`, `read_notebook_cell`).
   */
  ctx?: ToolExecutionContext;
  /** Default OFF. Adds Gemini's built-in `googleSearch` tool. */
  enableGoogleSearch?: boolean;
  /** Default OFF. Adds Gemini's built-in `codeExecution` tool. */
  enableCodeExecution?: boolean;
  /**
   * Default `true`. When `false`, the loop computes a `PendingMerge` for
   * any authoritative merge instead of mutating `accumulated`, then
   * fires `onPendingMerge` and returns. Continue resumes from the
   * cursor after the user accepts / rejects hunks (Req 5.4).
   */
  autoAccept?: boolean;
  /**
   * Queued user message injected as a fresh user turn before the next
   * iteration's SDK call (Req 11.3). Cleared once injected.
   */
  pendingUserSteer?: string;
  /** Praktikum vs kuliah — persisted on `LoopCursor` for resume fidelity. */
  declarationKey?: 'praktikum' | 'kuliah';
}

/**
 * Internal per-chunk delta. Collapses the two places Gemini places tool
 * calls (candidate-parts stream and `functionCalls` convenience field).
 */
type StreamDelta =
  | { kind: 'thought'; text: string }
  | { kind: 'text'; text: string }
  | {
      kind: 'tool';
      name: string;
      args: unknown;
      id: string;
      thoughtSignature?: string;
    };

function* extractDeltas(chunk: unknown): Generator<StreamDelta> {
  const c = chunk as {
    candidates?: { content?: { parts?: Part[] } }[];
    functionCalls?: { name?: string; args?: unknown; id?: string }[];
  };

  const seenToolIds = new Set<string>();

  const parts = c.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      const p = part as Part & {
        thought?: boolean;
        thoughtSignature?: string;
        thought_signature?: string;
      };
      const thoughtSignature = p.thoughtSignature || p.thought_signature;

      if (p.thought) {
        yield { kind: 'thought', text: p.text || '' };
      } else if (p.text) {
        yield { kind: 'text', text: p.text };
      } else if (p.functionCall) {
        const id = p.functionCall.id || '';
        if (id) seenToolIds.add(id);
        yield {
          kind: 'tool',
          name: p.functionCall.name || '',
          args: p.functionCall.args,
          id,
          thoughtSignature,
        };
      }
    }
  }

  // Fallback: some SDK versions also surface function calls in the
  // top-level `functionCalls` array as a convenience. We only emit the
  // ones we haven't already seen via the parts walk so multi-tool turns
  // don't get double-counted.
  if (c.functionCalls && c.functionCalls.length > 0) {
    for (const fc of c.functionCalls) {
      const id = fc.id || '';
      if (id && seenToolIds.has(id)) continue;
      yield {
        kind: 'tool',
        name: fc.name || '',
        args: fc.args ?? null,
        id,
      };
    }
  }
}

/**
 * Wrap an async iterable so the consumer can abort mid-await without
 * waiting for the next chunk to arrive. Without this, a Stop during a
 * slow streaming response only takes effect on the next chunk boundary
 * — by which time the SDK may have delivered the full tool call,
 * causing the post-merge system message to fire AFTER the user's
 * "Run stopped by user" lands. Cursor-style halts are immediate.
 *
 * On abort we call `iter.return?.()` so the generator (and the
 * underlying fetch through `@google/genai`) closes cleanly.
 */
async function* abortableStream<T>(
  source: AsyncIterable<T>,
  signal: AbortSignal | undefined,
): AsyncGenerator<T> {
  if (!signal) {
    yield* source;
    return;
  }

  const iter = source[Symbol.asyncIterator]();
  const closeIter = async () => {
    try {
      await iter.return?.(undefined);
    } catch {
      // Closing a partially-consumed iterator may throw; we're bailing.
    }
  };

  const ABORTED: unique symbol = Symbol('aborted');

  while (true) {
    if (signal.aborted) {
      await closeIter();
      return;
    }

    const abortPromise = new Promise<typeof ABORTED>((resolve) => {
      if (signal.aborted) {
        resolve(ABORTED);
        return;
      }
      const onAbort = () => {
        signal.removeEventListener('abort', onAbort);
        resolve(ABORTED);
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });

    const next = await Promise.race([iter.next(), abortPromise]);
    if (next === ABORTED) {
      await closeIter();
      return;
    }
    if (next.done) return;
    yield next.value;
  }
}

/**
 * Append-or-update one tool-call by id in the in-flight call list.
 * Returns whether the list materially changed so the caller can avoid
 * spurious re-renders. Same id ⇒ update args; new id ⇒ append.
 */
function upsertToolById(
  active: PendingTool[],
  delta: { name: string; args: unknown; id: string; thoughtSignature?: string },
): boolean {
  const existing = delta.id
    ? active.find((t) => t.id === delta.id)
    : active.find((t) => t.name === delta.name);
  if (!existing) {
    active.push({
      name: delta.name,
      args: delta.args,
      id: delta.id,
      thoughtSignature: delta.thoughtSignature,
    });
    return true;
  }
  let changed = false;
  if (JSON.stringify(existing.args) !== JSON.stringify(delta.args)) {
    existing.args = delta.args;
    changed = true;
  }
  if (delta.thoughtSignature && !existing.thoughtSignature) {
    existing.thoughtSignature = delta.thoughtSignature;
    changed = true;
  }
  return changed;
}

/** Extract grounding chunks from a Gemini response, if present. */
function extractCitations(chunk: unknown): GroundingChunk[] {
  const c = chunk as {
    candidates?: {
      groundingMetadata?: {
        groundingChunks?: { web?: { uri?: string; title?: string }; snippet?: string }[];
      };
    }[];
  };
  const raw = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => ({
      uri: g.web?.uri,
      title: g.web?.title,
      snippet: g.snippet,
    }))
    .filter((c) => c.uri || c.title || c.snippet);
}

/** Extract executableCode / codeExecutionResult parts, if present. */
function extractCodeBlocks(chunk: unknown): CodeExecutionBlock[] {
  const c = chunk as { candidates?: { content?: { parts?: Part[] } }[] };
  const parts = c.candidates?.[0]?.content?.parts;
  if (!parts) return [];
  const blocks: CodeExecutionBlock[] = [];
  let pendingCode: { language?: string; code: string } | null = null;
  for (const part of parts) {
    const p = part as Part & {
      executableCode?: { language?: string; code?: string };
      codeExecutionResult?: { output?: string };
    };
    if (p.executableCode?.code) {
      pendingCode = {
        language: p.executableCode.language,
        code: p.executableCode.code,
      };
      blocks.push({ ...pendingCode });
    } else if (p.codeExecutionResult && pendingCode) {
      // Attach the result to the most recent block.
      blocks[blocks.length - 1] = {
        ...blocks[blocks.length - 1],
        output: p.codeExecutionResult.output,
      };
    }
  }
  return blocks;
}

export async function runAgentLoop(args: AgentLoopArgs): Promise<AIReportData> {
  const { apiKey, declaration, sysMsgBuilder, callbacks } = args;

  // Resolve the working state. When a `resumeCursor` is supplied it is
  // authoritative — it replaces the corresponding `args` fields so a
  // resumed run uses the exact persisted conversation/state, not a
  // fresh one assembled by the caller.
  const cursor = args.resumeCursor;
  let accumulated: AIReportData = cursor
    ? { ...cursor.accumulatedAiData }
    : { ...args.initial };
  const resolvedMode: Extract<MergeMode, 'append' | 'replace'> = cursor
    ? cursor.mode
    : args.mode;
  const resolvedSystemInstruction = cursor
    ? cursor.systemInstruction
    : args.systemInstruction;
  let resolvedModelId = cursor ? cursor.modelId : args.modelId;
  const resolvedMaxLoops = cursor ? cursor.maxLoops : args.maxLoops;
  const resolvedDeclarationKey: 'praktikum' | 'kuliah' = cursor
    ? cursor.declarationKey
    : args.declarationKey ?? 'praktikum';
  const resolvedEnableGoogleSearch = cursor
    ? cursor.enableGoogleSearch
    : !!args.enableGoogleSearch;
  const resolvedEnableCodeExecution = cursor
    ? cursor.enableCodeExecution
    : !!args.enableCodeExecution;
  // `contents` on resume comes from the cursor; otherwise we mutate the
  // caller's array in place to preserve the existing legacy contract.
  const activeContents: Content[] = cursor ? [...cursor.contents] : args.contents;

  let loopIndex = cursor ? cursor.iterationIndex - 1 : 0;
  let lastSuccessfulMergeIndex = cursor ? cursor.lastSuccessfulMergeIndex : 0;
  let isDone = false;
  let pendingUserSteer = args.pendingUserSteer;
  const autoAccept = args.autoAccept !== false; // default true

  const ai = new GoogleGenAI({ apiKey });

  // Compose the SDK's `tools[]` array once per iteration. Built-in
  // tools share a single `Tool` entry alongside the function declarations.
  const buildSdkTools = (): unknown[] => {
    const declarations: ToolDeclaration[] = [
      // The legacy primary declaration (`generate_report`) is unwrapped
      // and treated as the same shape — the SDK accepts either form.
      declaration as ToolDeclaration,
      ...(args.extraTools?.declarations ?? []),
    ];
    const tools: Record<string, unknown>[] = [
      { functionDeclarations: declarations },
    ];
    if (resolvedEnableGoogleSearch) tools.push({ googleSearch: {} });
    if (resolvedEnableCodeExecution) tools.push({ codeExecution: {} });
    return tools;
  };

  const buildCursor = (nextIterationIndex: number, pendingTools: PendingTool[] = []): LoopCursor => ({
    contents: activeContents.slice(),
    iterationIndex: nextIterationIndex,
    lastSuccessfulMergeIndex,
    accumulatedAiData: accumulated,
    mode: resolvedMode,
    declarationKey: resolvedDeclarationKey,
    systemInstruction: resolvedSystemInstruction,
    modelId: resolvedModelId,
    maxLoops: resolvedMaxLoops,
    enableGoogleSearch: resolvedEnableGoogleSearch,
    enableCodeExecution: resolvedEnableCodeExecution,
    pendingTools,
  });

  while (!isDone && loopIndex < resolvedMaxLoops) {
    loopIndex++;

    // ----- Safe boundary 1: top of iteration -----
    if (callbacks.onLoopCursorUpdate) callbacks.onLoopCursorUpdate(buildCursor(loopIndex));
    if (args.signal?.aborted) return accumulated;

    // Inject any queued user steer as a fresh user turn before the SDK
    // call. We consume it once and clear so subsequent iterations
    // proceed normally (Req 11.3).
    if (pendingUserSteer && pendingUserSteer.trim().length > 0) {
      activeContents.push({
        role: 'user',
        parts: [{ text: pendingUserSteer } as Part],
      });
      pendingUserSteer = undefined;
    }

    callbacks.onStatus?.(
      loopIndex === 1
        ? 'Memeriksa dan mengatur urutan gambar (Cognitive Sorting)...'
        : `Melanjutkan ekstraksi data (Batch ${loopIndex})...`,
    );

    const msgId = callbacks.onIterationStart?.(loopIndex) ?? '';

    // ----- Stream the SDK call (with quota retry) -----
    let stream: AsyncIterable<unknown>;
    while (true) {
      try {
        stream = (await withQuotaRetry(
          () =>
            ai.models.generateContentStream({
              model: resolvedModelId,
              contents: activeContents as Part[],
              config: {
                systemInstruction: resolvedSystemInstruction,
                temperature: 0.2,
                ...(resolvedModelId.includes('gemini-3')
                  ? { thinkingConfig: { thinkingLevel: 'medium' } as any }
                  : { thinkingConfig: { includeThoughts: true } as any }),
                tools: buildSdkTools() as never,
                toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
              },
            }),
          {
            schedule: args.retryConfig?.schedule,
            signal: args.signal,
            onAttempt: callbacks.onRetryAttempt,
          },
        )) as AsyncIterable<unknown>;
        break; // Success
      } catch (err) {
        if (args.signal?.aborted) return accumulated;
        if (isQuotaError(err) && resolvedModelId !== 'gemini-flash-latest') {
          callbacks.onStatus?.(`Quota habis pada model ${resolvedModelId}. Beralih ke gemini-flash-latest...`);
          callbacks.onSystemMessage?.(`⚠️ Limit quota pada model ${resolvedModelId} telah tercapai. Beralih secara otomatis ke model gemini-flash-latest.`);
          resolvedModelId = 'gemini-flash-latest';
          continue; // Retry inner loop
        }
        throw err;
      }
    }

    // Multi-tool turn state — Gemini 3 may emit multiple parallel or
    // sequential `functionCall` parts in one streaming response. We
    // accumulate them in declaration order with `pendingTools` and
    // dispatch them after the stream closes.
    const pendingTools: PendingTool[] = [];
    let thoughtSignature = ''; // first signature wins for the first call
    let thoughtStream = '';
    let textStream = '';
    const activeUiTools: ToolCallState[] = [];

    for await (const chunk of abortableStream(stream, args.signal)) {
      let changed = false;

      for (const delta of extractDeltas(chunk)) {
        switch (delta.kind) {
          case 'thought':
            thoughtStream += delta.text;
            changed = true;
            break;
          case 'text':
            textStream += delta.text;
            changed = true;
            break;
          case 'tool': {
            if (delta.thoughtSignature && !thoughtSignature) {
              thoughtSignature = delta.thoughtSignature;
            }
            const existed = pendingTools.some((t) =>
              delta.id ? t.id === delta.id : t.name === delta.name,
            );
            const before = JSON.stringify(pendingTools);
            upsertToolById(pendingTools, delta);
            const after = JSON.stringify(pendingTools);
            if (before !== after) changed = true;

            // Mirror to the UI tool list (deduped by name for display).
            const uiExisting = activeUiTools.find((t) => t.name === delta.name);
            if (!uiExisting) {
              activeUiTools.push({ name: delta.name, status: 'running', args: delta.args });
            } else if (JSON.stringify(uiExisting.args) !== JSON.stringify(delta.args)) {
              uiExisting.args = delta.args;
            }
            void existed;
            break;
          }
        }
      }

      if (changed) {
        callbacks.onThought?.(thoughtStream);
        callbacks.onText?.(textStream);
        callbacks.onToolUpdate?.([...activeUiTools]);
      }

      // Citations + code-execution surfacing per chunk. These don't
      // affect the loop's control flow; they're informational.
      if (resolvedEnableGoogleSearch && callbacks.onCitations) {
        const cites = extractCitations(chunk);
        if (cites.length > 0) callbacks.onCitations(cites);
      }
      if (resolvedEnableCodeExecution && callbacks.onCodeExecution) {
        const blocks = extractCodeBlocks(chunk);
        for (const b of blocks) callbacks.onCodeExecution(b);
      }

      // Streaming-time preview merge: non-authoritative, best-effort.
      // Only the legacy `generate_report` path produces a structured
      // preview — granular tools land their previews via the executor
      // dispatch step after the stream closes.
      const firstReport = pendingTools.find((t) => t.name === 'generate_report');
      if (firstReport?.args) {
        try {
          const previewMode: MergeMode = resolvedMode === 'replace' ? 'replace' : 'preview';
          const previewed = mergeReportData(
            accumulated,
            firstReport.args as Parameters<typeof mergeReportData>[1],
            previewMode,
          );
          callbacks.onPreviewMerge?.(previewed);
        } catch {
          // Preview failures are non-fatal; the authoritative merge below
          // still runs on the final args.
        }
      }
    }

    // Mid-stream abort: drop the partial response entirely. The cursor
    // was snapshotted at the top of this iteration so a Continue will
    // re-run it from scratch. Critically, NOTHING that follows in this
    // iteration body should run — no merge, no checkpoint, no system
    // message, no functionResponse push. Otherwise Stop wouldn't feel
    // immediate (the user would see a "batch N berhasil diproses"
    // message land *after* "Run stopped by user").
    if (args.signal?.aborted) {
      callbacks.onIterationEnd?.(msgId, [...activeUiTools]);
      return accumulated;
    }

    // ----- Build the model turn from streamed parts -----
    // Per Gemini 3's thought-signature contract: the first part of the
    // model turn carries the thought signature; subsequent parts (be
    // they more function calls or text) do not. We attach the signature
    // to the first emitted part, in declaration order.
    const modelParts: Part[] = [];
    if (textStream) modelParts.push({ text: textStream } as Part);

    pendingTools.forEach((tool, i) => {
      const fcPart: Part & { thoughtSignature?: string; thought_signature?: string } = {
        functionCall: {
          name: tool.name,
          args: tool.args as Record<string, unknown>,
          id: tool.id,
        },
      } as Part;
      // First part of the turn (text-less case) or first function call
      // when text is absent receives the thought signature. When text
      // exists it captures the signature instead — but the SDK's text
      // part doesn't have a slot for it, so we tack it onto the first
      // function call. This matches the SDK's convention.
      if (i === 0 && thoughtSignature && !textStream) {
        fcPart.thoughtSignature = thoughtSignature;
        fcPart.thought_signature = thoughtSignature;
        // Persist on the pending tool too so the cursor's resume snapshot
        // can re-emit the signature on the next request.
        tool.thoughtSignature = thoughtSignature;
      }
      modelParts.push(fcPart);
    });

    if (modelParts.length > 0) {
      activeContents.push({ role: 'model', parts: modelParts });
    } else if (thoughtStream) {
      activeContents.push({ role: 'model', parts: [{ text: '' } as Part] });
    }

    // ----- Dispatch each pending tool in order -----
    if (pendingTools.length === 0) {
      // No tool calls in this iteration → terminator.
      callbacks.onIterationEnd?.(msgId, [...activeUiTools]);
      isDone = true;
      break;
    }

    let mergedThisIteration = false;
    let clarificationRaised = false;
    let completionRaised = false;
    let completionSummary: string | undefined;
    const injectPartsForNext: Part[] = [];
    const functionResponseParts: Part[] = [];
    let pendingMergeForReview: PendingMerge | null = null;

    for (const tool of pendingTools) {
      // Legacy `generate_report` retains its byte-stable merge path so
      // the schema.test.ts and merge.test.ts snapshots stay green.
      if (tool.name === 'generate_report' && tool.args) {
        const mergedNext = mergeReportData(
          accumulated,
          tool.args as Parameters<typeof mergeReportData>[1],
          resolvedMode,
        );
        if (autoAccept) {
          accumulated = mergedNext;
          mergedThisIteration = true;
        } else if (!pendingMergeForReview) {
          // Auto-accept OFF: stash the first merge as a PendingMerge for review.
          pendingMergeForReview = {
            id: `pm-${Date.now()}`,
            createdAt: Date.now(),
            baseSnapshot: accumulated,
            mergedSnapshot: mergedNext,
            hunks: computeDiff(accumulated, mergedNext),
            iterationIndex: loopIndex,
          };
        }
        functionResponseParts.push({
          functionResponse: {
            name: tool.name,
            id: tool.id,
            response: { status: 'success', message: sysMsgBuilder(loopIndex) },
          },
        } as Part);
        continue;
      }

      // Granular / meta / inspection — dispatch via the registry.
      const executor = TOOL_REGISTRY.executors[tool.name];
      if (!executor) {
        functionResponseParts.push({
          functionResponse: {
            name: tool.name,
            id: tool.id,
            response: { status: 'error', message: `Unknown tool: ${tool.name}` },
          },
        } as Part);
        continue;
      }

      const result = executor.execute(tool.args, args.ctx ?? defaultCtx(accumulated));
      let responseMessage = 'success';

      switch (result.kind) {
        case 'merge': {
          const next = applyGranularMerge(accumulated, result.patch);
          if (autoAccept) {
            accumulated = next;
            mergedThisIteration = true;
          } else if (!pendingMergeForReview) {
            pendingMergeForReview = {
              id: `pm-${Date.now()}`,
              createdAt: Date.now(),
              baseSnapshot: accumulated,
              mergedSnapshot: next,
              hunks: computeDiff(accumulated, next),
              iterationIndex: loopIndex,
            };
          }
          break;
        }
        case 'plan':
          callbacks.onTaskPlan?.(result.steps);
          break;
        case 'plan-status':
          callbacks.onTaskStatus?.(result.id, result.status);
          break;
        case 'clarify':
          clarificationRaised = true;
          callbacks.onClarification?.(result.question);
          responseMessage = 'paused: awaiting user clarification';
          break;
        case 'complete':
          completionRaised = true;
          completionSummary = result.summary;
          callbacks.onTaskComplete?.(result.summary);
          responseMessage = 'task complete';
          break;
        case 'inspect':
          injectPartsForNext.push(...result.injectParts);
          responseMessage = 'inspection content queued for next turn';
          break;
        case 'noop':
          responseMessage = result.reason ?? 'noop';
          break;
      }

      functionResponseParts.push({
        functionResponse: {
          name: tool.name,
          id: tool.id,
          response: { status: result.kind === 'noop' ? 'error' : 'success', message: responseMessage },
        },
      } as Part);
    }

    // Flip every UI tool to completed before reporting the iteration end.
    for (const t of activeUiTools) t.status = 'completed';

    // Emit the unified merge-complete + checkpoint signals first, then
    // close the iteration message, then the system message. This order
    // is the legacy contract preserved for Req 9.5 — the snapshot test
    // in agent-loop.test.ts expects exactly:
    //   onMergeComplete → onCheckpointRequest → onIterationEnd → onSystemMessage
    if (mergedThisIteration) {
      lastSuccessfulMergeIndex = loopIndex;
      callbacks.onMergeComplete?.(accumulated, loopIndex);
      callbacks.onCheckpointRequest?.({ aiData: accumulated, loopIndex });
    }

    callbacks.onIterationEnd?.(msgId, [...activeUiTools]);

    if (mergedThisIteration) {
      const sysText = sysMsgBuilder(loopIndex);
      callbacks.onSystemMessage?.(sysText);
    }

    // ----- pendingMerge gate (auto-accept OFF) -----
    if (pendingMergeForReview) {
      callbacks.onPendingMerge?.(pendingMergeForReview);
      // Snapshot a cursor that will resume at the SAME iteration index
      // we just finished — accept/reject doesn't advance us; the next
      // continue runs the next iteration normally.
      if (callbacks.onLoopCursorUpdate) callbacks.onLoopCursorUpdate(buildCursor(loopIndex + 1));
      // Push the functionResponses so the next SDK call has them.
      activeContents.push({ role: 'user', parts: functionResponseParts });
      return accumulated;
    }

    // Push functionResponses + any inspection-injected parts for the next turn.
    activeContents.push({ role: 'user', parts: functionResponseParts });
    if (injectPartsForNext.length > 0) {
      activeContents.push({ role: 'user', parts: injectPartsForNext });
    }

    // ----- Termination conditions -----
    if (completionRaised || clarificationRaised) {
      isDone = true;
      // Emit one final cursor snapshot so the consumer can persist it.
      // For clarification we keep the cursor; for completion the hook
      // typically clears it. Either way the loop exits gracefully.
      if (callbacks.onLoopCursorUpdate) callbacks.onLoopCursorUpdate(buildCursor(loopIndex + 1));
      // A final summary message for completion was already surfaced via
      // onTaskComplete; the hook layer is responsible for appending it
      // to the chat thread.
      void completionSummary;
      break;
    }

    // ----- Safe boundary 2: post-merge cursor + abort check -----
    if (callbacks.onLoopCursorUpdate) callbacks.onLoopCursorUpdate(buildCursor(loopIndex + 1));
    if (args.signal?.aborted) return accumulated;
  }

  return accumulated;
}

/**
 * Sane-empty `ToolExecutionContext` used when a caller forgot to pass
 * `args.ctx` but the agent still calls an inspection tool. Returns
 * empty image buckets and an empty notebook list so the executor
 * gracefully degrades to a `noop` rather than crashing.
 */
function defaultCtx(aiData: AIReportData): ToolExecutionContext {
  return {
    images: { pre_test: [], implementasi: [], post_test: [], notebook: [] },
    notebooks: [],
    aiData,
  };
}
