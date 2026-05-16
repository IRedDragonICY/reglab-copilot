/**
 * Shared runtime types for the Copilot agent upgrade.
 *
 * This module is the single source of truth for non-AI Copilot domain
 * shapes — run state, checkpoints, loop cursor, pending merges, diff
 * hunks, task plans, and persisted settings. Other modules import from
 * here so consumers never reach into `src/lib/ai/*` for things that
 * are not strictly AI-loop concerns.
 *
 * Persistence contract: every type below is JSON-serializable. New
 * fields on existing shapes MUST be added as optional so legacy
 * IndexedDB payloads continue to deserialize without migration.
 *
 * Scope: types only. The single runtime export is
 * `DEFAULT_COPILOT_SETTINGS`, used by both the Zustand initializer
 * and the v1 → v2 persist migrator.
 */

import type { Content } from '@google/genai';
import type { AIReportData, CellAnalysis, QAPair } from '@/lib/types';
import type { CopilotMessage, ToolCallState } from '@/lib/ai/agent-loop';

// Re-export CopilotMessage and ToolCallState so Copilot consumers
// don't reach into the AI module for chat / tool-frame shapes.
export type { CopilotMessage, ToolCallState };

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

/**
 * Lifecycle state of an Agent_Loop for a single session.
 *
 * Transitions are driven by user actions (Pause / Stop / Continue /
 * Revert) and by terminal events inside `runAgentLoop`
 * (`mark_task_complete`, `maxLoops` reached, unrecoverable error). See
 * design.md "Run State Machine" for the full diagram.
 */
export type RunState = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

// ---------------------------------------------------------------------------
// Task plan (set_task_plan / update_task_status meta-tools)
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'active' | 'done';

export interface TaskPlanStep {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
}

export interface TaskPlan {
  steps: TaskPlanStep[];
  /** Iteration index at which the plan was first declared. */
  setAtIteration: number;
}

// ---------------------------------------------------------------------------
// Loop cursor (resume state)
// ---------------------------------------------------------------------------

/**
 * One pending tool call captured mid-iteration so a paused multi-tool
 * turn can resume with `thought_signature` echoes preserved in the
 * order Gemini emitted them.
 */
export interface PendingTool {
  name: string;
  args: unknown;
  id: string;
  thoughtSignature?: string;
}

/**
 * Minimum state needed to resume an interrupted Agent_Loop.
 *
 * Persisted on `ReportSession.loopCursor` so a Pause that survives a
 * tab switch or page reload can be resumed from the next iteration.
 * Cleared on `mark_task_complete`, Stop, and `maxLoops` exhaustion.
 */
export interface LoopCursor {
  /**
   * Full SDK conversation, including image inlineData. The cursor
   * stores the contents as-is on first persist; a future optimization
   * may swap inline images for `{ kind: 'ref', ... }` references —
   * see design.md "Open Questions".
   */
  contents: Content[];
  iterationIndex: number;
  lastSuccessfulMergeIndex: number;
  accumulatedAiData: AIReportData;
  mode: 'append' | 'replace';
  /** Resolved at runtime to the actual function declaration. */
  declarationKey: 'praktikum' | 'kuliah';
  systemInstruction: string;
  modelId: string;
  maxLoops: number;
  enableGoogleSearch: boolean;
  enableCodeExecution: boolean;
  /** Multi-tool turn resumption (Gemini 3 thought-signature contract). */
  pendingTools: PendingTool[];
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

/**
 * Immutable snapshot of `{ aiData, chatHistory, loopCursor }` taken
 * automatically after every authoritative merge and optionally by
 * manual user action. Eviction policy lives in
 * `src/lib/copilot/checkpoint-store.ts` (task 3.1).
 */
export interface Checkpoint {
  /** crypto.randomUUID() */
  id: string;
  /** Date.now() */
  createdAt: number;
  /** Human-readable, e.g. "After iteration 3" or a manual override. */
  label: string;
  source: 'auto' | 'manual';
  aiDataSnapshot: AIReportData;
  chatHistorySnapshot: CopilotMessage[];
  loopCursorSnapshot: LoopCursor | null;
}

/**
 * Archived chat thread within a single `ReportSession`.
 *
 * Each report ("project" in Cursor parlance) owns its own list of
 * chat threads. The currently-open thread lives on
 * `ReportSession.chatHistory`; previous threads are archived here and
 * surfaced via the panel's History (🕘) drawer. Threads from other
 * sessions are NEVER shown here — history is scoped to the current
 * report only, like Cursor's per-project chat list.
 */
export interface ChatThread {
  /** crypto.randomUUID() */
  id: string;
  /** Auto-derived from the first user message; fallback timestamp. */
  title: string;
  /** Date.now() at archive time. */
  createdAt: number;
  /** Date.now() of the last message (or archive time if empty). */
  updatedAt: number;
  /** Frozen message list at archive time. */
  messages: CopilotMessage[];
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

/**
 * Structural stand-in for the `diff` npm package's `Change` type.
 * Defined locally so this foundation file can ship before the `diff`
 * dependency is installed in task 16.1; the `Change` shape from `diff`
 * is `{ value: string; added?: boolean; removed?: boolean; count?: number }`,
 * which assigns to `LineChange` without modification. Once 16.1 lands,
 * usages may swap to `import('diff').Change` directly with no churn at
 * call sites.
 */
export interface LineChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * Per-pair diff result for `preTestAnswers` / `postTestAnswers`. The
 * exact shape is finalized when the diff engine lands (task 16.x);
 * this minimal definition is sufficient for `Hunk` to compile and is
 * structurally extensible.
 */
export interface QAPairDiff {
  index: number;
  kind: 'add' | 'remove' | 'modify' | 'unchanged';
  before?: QAPair;
  after?: QAPair;
}

/**
 * Composite key for a `cellAnalyses` entry. The literal `'_'` is the
 * wildcard used when an entry has no notebook/cell/image index (e.g.
 * a synthesized post-test entry).
 */
export type CellAnalysisKey =
  `${number | '_'}-${number | '_'}-${number | '_'}-${'implementasi' | 'post_test'}`;

/**
 * One reviewable change between a base snapshot and a merged snapshot.
 * Hunks are grouped by top-level `AIReportData` field, with
 * `cellAnalyses` further split per entry.
 */
export type Hunk =
  | {
      id: string;
      field: 'pendahuluan' | 'stepByStepNarrative' | 'codeAnalysis';
      before: string;
      after: string;
      lineDiff: LineChange[];
    }
  | {
      id: string;
      field: 'preTestAnswers' | 'postTestAnswers';
      before: QAPair[];
      after: QAPair[];
      pairDiffs: QAPairDiff[];
    }
  | {
      id: string;
      field: 'alatDanBahan';
      before: string[];
      after: string[];
      lineDiff: LineChange[];
    }
  | {
      id: string;
      field: 'cellAnalyses';
      entryKey: CellAnalysisKey;
      kind: 'add' | 'remove' | 'modify';
      before?: CellAnalysis;
      after?: CellAnalysis;
    };

// ---------------------------------------------------------------------------
// Pending merge (Auto_Accept_Mode = OFF)
// ---------------------------------------------------------------------------

/**
 * A merge that has been computed but not yet applied to `aiData`,
 * surfaced as a `<DiffView />` modal with per-hunk Accept / Reject
 * controls. Held on `ReportSession.pendingMerge` while
 * `copilotSettings.autoAccept === false`.
 */
export interface PendingMerge {
  /** Hunk-session id. */
  id: string;
  createdAt: number;
  /** Pre-merge snapshot; equals current aiData when paused. */
  baseSnapshot: AIReportData;
  /** What aiData would become if every hunk is accepted. */
  mergedSnapshot: AIReportData;
  hunks: Hunk[];
  /** Iteration that produced this merge. */
  iterationIndex: number;
}

// ---------------------------------------------------------------------------
// User-facing settings
// ---------------------------------------------------------------------------

/**
 * App-wide Copilot settings, persisted at the top level of
 * `useAppStore` (not per-session). See Requirement 10.
 */
export interface CopilotSettings {
  /** Default ON. When OFF, merges pause on `pendingMerge` for review. */
  autoAccept: boolean;
  /** Default OFF. Adds Gemini's `googleSearch` built-in tool. */
  googleSearch: boolean;
  /** Default OFF. Adds Gemini's `codeExecution` built-in tool. */
  codeExecution: boolean;
  /** Default 15. Clamped to [1, 30] by the store setter. */
  maxIterations: number;
}

/**
 * Defaults applied by the v1 → v2 persist migrator and by the store
 * initializer when no `copilotSettings` slice exists yet. `as const`
 * preserves literal types so consumers can pattern-match on values.
 */
export const DEFAULT_COPILOT_SETTINGS = {
  autoAccept: true,
  googleSearch: false,
  codeExecution: false,
  maxIterations: 15,
} as const satisfies CopilotSettings;
