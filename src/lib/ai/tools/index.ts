/**
 * Public surface of the granular / meta / inspection tool subsystem.
 *
 * This module is the single import point for the agent loop and the
 * UI-facing hooks: it re-exports the byte-stable declaration bundle
 * from `./declarations.ts` (task 8.1) and stakes out the runtime
 * contracts — `ToolExecutor`, `ToolExecutionContext`, `GranularPatch`,
 * `CellMatcher`, `ToolExecutorResult` — that downstream waves
 * (granular merge in 9.x, meta + inspect executors in 10.x) will hook
 * into.
 *
 * Module graph rationale: `GranularPatch` and `CellMatcher` live here
 * rather than in `./granular-merge.ts` so 9.x can `import type
 * { GranularPatch } from '.'` without the dispatch module needing to
 * re-export them — keeping the registry as the single source of truth
 * and preventing a circular `index.ts ↔ granular-merge.ts` graph.
 *
 * The `TOOL_REGISTRY.declarations` array is referentially identical
 * to `ALL_GRANULAR_DECLARATIONS`; the agent loop wires it directly
 * into `tools[].functionDeclarations` on `generateContentStream`.
 * `TOOL_REGISTRY.executors` is intentionally an empty mutable record
 * at this stake — tasks 9.x and 10.x populate it via
 * `Object.assign(TOOL_REGISTRY.executors, { ... })` from their own
 * modules so each wave only touches its own files.
 */

import type { Part } from '@google/genai';
import type { AIReportData, CellAnalysis, QAPair, UserImage } from '@/lib/types';
import type { TaskPlanStep, TaskStatus } from '@/lib/copilot/types';
import type { ParsedNotebook } from '@/lib/parser';
import {
  ALL_GRANULAR_DECLARATIONS,
  type ToolDeclaration,
} from './declarations';

// Re-export the declaration shape and constants from this module so
// consumers can `import { ToolDeclaration, ALL_GRANULAR_DECLARATIONS } from '@/lib/ai/tools'`.
export type { ToolDeclaration } from './declarations';
export {
  ALL_GRANULAR_DECLARATIONS,
  addCellAnalysisDeclaration,
  updateCellAnalysisDeclaration,
  deleteCellAnalysisDeclaration,
  setPendahuluanDeclaration,
  setAlatDanBahanDeclaration,
  setStepByStepNarrativeDeclaration,
  setCodeAnalysisDeclaration,
  setPreTestQaDeclaration,
  setPostTestQaDeclaration,
  setTaskPlanDeclaration,
  updateTaskStatusDeclaration,
  requestUserClarificationDeclaration,
  markTaskCompleteDeclaration,
  inspectImageDeclaration,
  readNotebookCellDeclaration,
} from './declarations';

// ---------------------------------------------------------------------------
// Granular merge contracts
// ---------------------------------------------------------------------------

/**
 * Selects an existing `CellAnalysis` entry for `update_cell_analysis`
 * / `delete_cell_analysis`. `section` is required; the index fields
 * act as wildcards when omitted (per Req 6.1) and the first matching
 * entry in document order is targeted by `applyGranularMerge` (task
 * 9.1).
 */
export interface CellMatcher {
  notebookIndex?: number;
  cellIndex?: number;
  imageIndex?: number;
  section: 'implementasi' | 'post_test';
}

/**
 * Tagged union describing a single granular mutation against
 * `AIReportData`. `applyGranularMerge` (task 9.1) switches on `tool`
 * and returns a new `AIReportData` — the legacy `mergeReportData`
 * path is left untouched.
 */
export type GranularPatch =
  | { tool: 'add_cell_analysis'; entry: CellAnalysis }
  | { tool: 'update_cell_analysis'; matcher: CellMatcher; patch: Partial<CellAnalysis> }
  | { tool: 'delete_cell_analysis'; matcher: CellMatcher }
  | { tool: 'set_pendahuluan'; text: string }
  | { tool: 'set_alat_dan_bahan'; items: string[] }
  | { tool: 'set_step_by_step_narrative'; text: string }
  | { tool: 'set_code_analysis'; text: string }
  | { tool: 'set_pre_test_qa'; pairs: QAPair[] }
  | { tool: 'set_post_test_qa'; pairs: QAPair[] };

// ---------------------------------------------------------------------------
// Executor contracts
// ---------------------------------------------------------------------------

/**
 * Discriminated outcome of dispatching a single tool call. Executors
 * never mutate state directly — they describe the intended effect and
 * the agent loop applies it. This keeps merges atomic, checkpoint-able,
 * and replayable from a `LoopCursor`.
 *
 * - `merge`        → apply `patch` via `applyGranularMerge`
 * - `plan`         → seed `session.taskPlan.steps`
 * - `plan-status`  → update one step's status by id
 * - `clarify`      → set `session.pendingClarification`, pause the loop
 * - `complete`     → terminal: `mark_task_complete`
 * - `inspect`      → inject `injectParts` into the next `contents` turn
 * - `noop`         → executor declined or args invalid; surface `reason`
 */
export type ToolExecutorResult =
  | { kind: 'merge'; patch: GranularPatch }
  | { kind: 'plan'; steps: TaskPlanStep[] }
  | { kind: 'plan-status'; id: string; status: TaskStatus }
  | { kind: 'clarify'; question: string }
  | { kind: 'complete'; summary?: string }
  | { kind: 'inspect'; injectParts: Part[] }
  | { kind: 'noop'; reason?: string };

/**
 * Read-only context handed to executors that need access to images or
 * notebooks (currently `inspect_image` and `read_notebook_cell`,
 * landing in task 10.x). The shape is intentionally a v1 stake —
 * fields may be added as later tools require them, but existing
 * fields will not be renamed.
 *
 * `aiData` is read-only by convention: executors describe mutations
 * via `{ kind: 'merge', patch }` rather than mutating in place, so
 * the agent loop can checkpoint and revert atomically.
 */
export interface ToolExecutionContext {
  images: {
    pre_test: UserImage[];
    implementasi: UserImage[];
    post_test: UserImage[];
    /** Visual outputs harvested from notebook cells. */
    notebook: { dataUrl: string }[];
  };
  notebooks: ParsedNotebook[];
  aiData: AIReportData;
}

/**
 * One executor entry. `name` matches the corresponding
 * `ToolDeclaration.name`; the loop dispatches on the function-call
 * name returned by Gemini.
 */
export interface ToolExecutor {
  name: string;
  execute: (args: unknown, ctx: ToolExecutionContext) => ToolExecutorResult;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Tool registry consumed by the agent loop.
 *
 * - `declarations` is referentially `ALL_GRANULAR_DECLARATIONS` so
 *   the snapshot test in `declarations.test.ts` (task 8.1) doubles as
 *   the bytes test for what the agent actually sends.
 * - `executors` starts empty. Tasks 9.x and 10.x populate it from
 *   their own modules via
 *   `Object.assign(TOOL_REGISTRY.executors, { ... })` so each wave
 *   only edits the files it owns. The outer object is `as const` to
 *   lock the property shape; `executors` itself stays mutable by
 *   typing it as `Record<string, ToolExecutor>`.
 *
 * Dispatch site (agent loop, task 9.2):
 *   `TOOL_REGISTRY.executors[name]?.execute(args, ctx)`
 */
export const TOOL_REGISTRY = {
  declarations: ALL_GRANULAR_DECLARATIONS,
  executors: {} as Record<string, ToolExecutor>,
} as const;

// ---------------------------------------------------------------------------
// Wave-by-wave executor registration
// ---------------------------------------------------------------------------
//
// Each wave owns its own module and registers its executors here on
// load via `Object.assign(TOOL_REGISTRY.executors, ...)`. The granular
// merge wave (task 9.2) lands first; future waves append the same way:
//   - Task 10.1 adds `META_EXECUTORS` from `./meta`
//   - Task 10.2 adds `INSPECTION_EXECUTORS` from `./inspect`
//
// `granular-merge.ts` only `import type`s from this module, so the
// graph is one-directional at runtime: `index.ts` imports
// `granular-merge.ts`, never the reverse.

import { GRANULAR_EXECUTORS } from './granular-merge';
import { META_EXECUTORS } from './meta';
import { INSPECTION_EXECUTORS } from './inspect';

Object.assign(TOOL_REGISTRY.executors, GRANULAR_EXECUTORS);
Object.assign(TOOL_REGISTRY.executors, META_EXECUTORS);
Object.assign(TOOL_REGISTRY.executors, INSPECTION_EXECUTORS);
