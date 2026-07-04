/**
 * Granular merge dispatch (task 9.1).
 *
 * Each `GranularPatch` variant in the registry maps to one focused,
 * immutable mutation against an `AIReportData` snapshot. The agent
 * loop calls `applyGranularMerge` after a granular write tool fires
 * and feeds the result back through the existing `onMergeComplete` →
 * checkpoint flow (Req 6.9), so the new tools share the same
 * authoritative-merge boundary that `mergeReportData` (legacy
 * `generate_report` path) already uses.
 *
 * Design choices:
 * - Pure function. Returns a new `AIReportData`; the input is never
 *   mutated. Per-field spread is enough — `cellAnalyses` is the only
 *   array we touch and we always rebuild it.
 * - Single `switch (patch.tool)` so the discriminated union is
 *   exhaustively narrowed; adding a new `GranularPatch` variant in
 *   `tools/index.ts` will surface as a TypeScript error here.
 * - `update_cell_analysis` / `delete_cell_analysis` walk
 *   `cellAnalyses` in document order and stop at the first match
 *   (Req 6.1: undefined matcher index fields wildcard, `section` is
 *   the layout slot pin).
 * - When a matcher targets nothing, the input is returned by
 *   reference. This lets callers do an `===` short-circuit (e.g. to
 *   skip an unnecessary checkpoint), but the contract only promises
 *   deep equality.
 *
 * `mergeReportData` in `src/lib/ai/merge.ts` is intentionally NOT
 * touched — its snapshot tests are the regression guard for the
 * legacy single-tool path (Req 9.4).
 */

import type { AIReportData, CellAnalysis } from '@/lib/types';
import type { GranularPatch, CellMatcher } from './index';

/**
 * Apply a single `GranularPatch` to an `AIReportData` snapshot,
 * returning a new immutable `AIReportData`. Each tool case is a
 * focused mutation; unrelated fields pass through untouched.
 *
 * Matcher semantics (`update_cell_analysis` / `delete_cell_analysis`):
 * undefined matcher index fields act as wildcards. The first entry
 * in document order whose every defined matcher field matches is
 * targeted. `section` is required so we always pin the layout slot.
 * No-op (returns the input by reference) when no entries match.
 */
export function applyGranularMerge(
  current: AIReportData,
  patch: GranularPatch,
): AIReportData {
  switch (patch.tool) {
    case 'add_cell_analysis':
      return {
        ...current,
        cellAnalyses: [...(current.cellAnalyses ?? []), patch.entry],
      };

    case 'update_cell_analysis': {
      const cells = current.cellAnalyses ?? [];
      let mutated = false;
      const next = cells.map((cell) => {
        if (mutated) return cell;
        if (matches(cell, patch.matcher)) {
          mutated = true;
          return { ...cell, ...patch.patch };
        }
        return cell;
      });
      if (!mutated) return current;
      return { ...current, cellAnalyses: next };
    }

    case 'delete_cell_analysis': {
      const cells = current.cellAnalyses ?? [];
      let removed = false;
      const next = cells.filter((cell) => {
        if (removed) return true;
        if (matches(cell, patch.matcher)) {
          removed = true;
          return false;
        }
        return true;
      });
      if (!removed) return current;
      return { ...current, cellAnalyses: next };
    }

    case 'set_pendahuluan':
      return { ...current, pendahuluan: patch.text };

    case 'set_alat_dan_bahan':
      return { ...current, alatDanBahan: patch.items };

    case 'set_step_by_step_narrative':
      return { ...current, stepByStepNarrative: patch.text };

    case 'set_code_analysis':
      return { ...current, codeAnalysis: patch.text };

    case 'set_pre_test_qa':
      return { ...current, preTestAnswers: patch.pairs };

    case 'set_post_test_qa':
      return { ...current, postTestAnswers: patch.pairs };

    case 'set_ulasan_praktikum':
      return { ...current, ulasanPraktikum: patch.text };
  }
}

/**
 * Returns true iff `cell`'s `(section, notebookIndex, cellIndex,
 * imageIndex)` match the matcher. `section` is required; index
 * fields are wildcards when undefined on the matcher.
 */
function matches(cell: CellAnalysis, matcher: CellMatcher): boolean {
  if (cell.section !== matcher.section) return false;
  if (matcher.notebookIndex !== undefined && cell.notebookIndex !== matcher.notebookIndex) {
    return false;
  }
  if (matcher.cellIndex !== undefined && cell.cellIndex !== matcher.cellIndex) {
    return false;
  }
  if (matcher.imageIndex !== undefined && cell.imageIndex !== matcher.imageIndex) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Granular tool executors (task 9.2)
// ---------------------------------------------------------------------------

/**
 * Each executor below wraps the validated args into a `GranularPatch`
 * and returns `{ kind: 'merge', patch }`. Invalid args (missing
 * required fields, wrong type) return `{ kind: 'noop', reason }`
 * instead of throwing — the agent loop relies on this contract to
 * send a `functionResponse` describing the validation error back to
 * Gemini without aborting the iteration.
 *
 * The aggregator `GRANULAR_EXECUTORS` is consumed at module load by
 * `tools/index.ts` (`Object.assign(TOOL_REGISTRY.executors, ...)`) so
 * each wave (granular here, meta in 10.1, inspection in 10.2) can
 * append to the same registry without editing each other's files.
 *
 * `ToolExecutor` and friends are imported as types only to keep the
 * module graph one-directional: this file is the runtime owner of
 * the granular executors; `index.ts` only re-exports their types.
 */

import type { ToolExecutor, ToolExecutorResult } from './index';
import type { QAPair } from '@/lib/types';

/**
 * Loose shape check used by `add_cell_analysis` and `update_cell_analysis`.
 * Field-level type checks happen in each executor — this only confirms
 * we're looking at a non-null object before reaching in.
 */
function isObjectLike(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/**
 * Validates a `CellMatcher` payload. Required: `section` is one of the
 * two allowed strings. Optional index fields, when defined, must be
 * numbers (undefined is the wildcard per Req 6.1).
 */
function isCellMatcher(x: unknown): x is CellMatcher {
  if (!isObjectLike(x)) return false;
  if (x.section !== 'implementasi' && x.section !== 'post_test') return false;
  for (const f of ['notebookIndex', 'cellIndex', 'imageIndex'] as const) {
    if (x[f] !== undefined && typeof x[f] !== 'number') return false;
  }
  return true;
}

/** Validates `QAPair[]` shape: every element has string `q` and string `a`. */
function isQAPairArray(x: unknown): x is QAPair[] {
  return (
    Array.isArray(x) &&
    x.every(
      (p) =>
        isObjectLike(p) &&
        typeof (p as Record<string, unknown>).q === 'string' &&
        typeof (p as Record<string, unknown>).a === 'string',
    )
  );
}

/**
 * `add_cell_analysis(entry: CellAnalysis)` — append one entry.
 * Requires `entry.section`, `entry.caption`, `entry.explanation`.
 */
export const addCellAnalysisExecutor: ToolExecutor = {
  name: 'add_cell_analysis',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs)) {
      return { kind: 'noop', reason: 'add_cell_analysis: args must be an object' };
    }
    const entry = rawArgs.entry;
    if (!isObjectLike(entry)) {
      return { kind: 'noop', reason: 'add_cell_analysis: entry is required' };
    }
    if (entry.section !== 'implementasi' && entry.section !== 'post_test') {
      return { kind: 'noop', reason: "add_cell_analysis: entry.section must be 'implementasi' or 'post_test'" };
    }
    if (typeof entry.caption !== 'string') {
      return { kind: 'noop', reason: 'add_cell_analysis: entry.caption must be a string' };
    }
    if (typeof entry.explanation !== 'string') {
      return { kind: 'noop', reason: 'add_cell_analysis: entry.explanation must be a string' };
    }
    return { kind: 'merge', patch: { tool: 'add_cell_analysis', entry: entry as unknown as CellAnalysis } };
  },
};

/**
 * `update_cell_analysis(matcher, patch)` — patch the first matching entry.
 * Requires a valid `CellMatcher` plus a non-null `patch` object.
 */
export const updateCellAnalysisExecutor: ToolExecutor = {
  name: 'update_cell_analysis',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs)) {
      return { kind: 'noop', reason: 'update_cell_analysis: args must be an object' };
    }
    if (!isCellMatcher(rawArgs.matcher)) {
      return { kind: 'noop', reason: 'update_cell_analysis: matcher is invalid (section is required)' };
    }
    if (!isObjectLike(rawArgs.patch)) {
      return { kind: 'noop', reason: 'update_cell_analysis: patch is required' };
    }
    return {
      kind: 'merge',
      patch: {
        tool: 'update_cell_analysis',
        matcher: rawArgs.matcher,
        patch: rawArgs.patch as Partial<CellAnalysis>,
      },
    };
  },
};

/**
 * `delete_cell_analysis(matcher)` — remove the first matching entry.
 */
export const deleteCellAnalysisExecutor: ToolExecutor = {
  name: 'delete_cell_analysis',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs)) {
      return { kind: 'noop', reason: 'delete_cell_analysis: args must be an object' };
    }
    if (!isCellMatcher(rawArgs.matcher)) {
      return { kind: 'noop', reason: 'delete_cell_analysis: matcher is invalid (section is required)' };
    }
    return {
      kind: 'merge',
      patch: { tool: 'delete_cell_analysis', matcher: rawArgs.matcher },
    };
  },
};

/** `set_pendahuluan(text: string)` — replace `pendahuluan`. */
export const setPendahuluanExecutor: ToolExecutor = {
  name: 'set_pendahuluan',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || typeof rawArgs.text !== 'string') {
      return { kind: 'noop', reason: 'set_pendahuluan: text must be a string' };
    }
    return { kind: 'merge', patch: { tool: 'set_pendahuluan', text: rawArgs.text } };
  },
};

/** `set_alat_dan_bahan(items: string[])` — replace `alatDanBahan`. */
export const setAlatDanBahanExecutor: ToolExecutor = {
  name: 'set_alat_dan_bahan',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || !Array.isArray(rawArgs.items) ||
        !rawArgs.items.every((x) => typeof x === 'string')) {
      return { kind: 'noop', reason: 'set_alat_dan_bahan: items must be string[]' };
    }
    return { kind: 'merge', patch: { tool: 'set_alat_dan_bahan', items: rawArgs.items as string[] } };
  },
};

/** `set_step_by_step_narrative(text: string)` — replace `stepByStepNarrative`. */
export const setStepByStepNarrativeExecutor: ToolExecutor = {
  name: 'set_step_by_step_narrative',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || typeof rawArgs.text !== 'string') {
      return { kind: 'noop', reason: 'set_step_by_step_narrative: text must be a string' };
    }
    return { kind: 'merge', patch: { tool: 'set_step_by_step_narrative', text: rawArgs.text } };
  },
};

/** `set_code_analysis(text: string)` — replace `codeAnalysis`. */
export const setCodeAnalysisExecutor: ToolExecutor = {
  name: 'set_code_analysis',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || typeof rawArgs.text !== 'string') {
      return { kind: 'noop', reason: 'set_code_analysis: text must be a string' };
    }
    return { kind: 'merge', patch: { tool: 'set_code_analysis', text: rawArgs.text } };
  },
};

/** `set_pre_test_qa(pairs: QAPair[])` — replace `preTestAnswers`. */
export const setPreTestQaExecutor: ToolExecutor = {
  name: 'set_pre_test_qa',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || !isQAPairArray(rawArgs.pairs)) {
      return { kind: 'noop', reason: 'set_pre_test_qa: pairs must be an array of { q, a } pairs' };
    }
    return { kind: 'merge', patch: { tool: 'set_pre_test_qa', pairs: rawArgs.pairs } };
  },
};

/** `set_post_test_qa(pairs: QAPair[])` — replace `postTestAnswers`. */
export const setPostTestQaExecutor: ToolExecutor = {
  name: 'set_post_test_qa',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || !isQAPairArray(rawArgs.pairs)) {
      return { kind: 'noop', reason: 'set_post_test_qa: pairs must be an array of { q, a } pairs' };
    }
    return { kind: 'merge', patch: { tool: 'set_post_test_qa', pairs: rawArgs.pairs } };
  },
};

/** `set_ulasan_praktikum(ulasan_praktikum: string)` — replace `ulasanPraktikum`. */
export const setUlasanPraktikumExecutor: ToolExecutor = {
  name: 'set_ulasan_praktikum',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || typeof rawArgs.ulasan_praktikum !== 'string') {
      return { kind: 'noop', reason: 'set_ulasan_praktikum: ulasan_praktikum must be a string' };
    }
    return { kind: 'merge', patch: { tool: 'set_ulasan_praktikum', text: rawArgs.ulasan_praktikum } };
  },
};

/**
 * Aggregator consumed by `tools/index.ts` to populate
 * `TOOL_REGISTRY.executors` on module load. Future waves (10.1 meta
 * executors, 10.2 inspection executors) append to the same registry
 * the same way — the registry is the single source of truth for
 * dispatch, and each wave only edits its own files.
 */
export const GRANULAR_EXECUTORS: Record<string, ToolExecutor> = {
  add_cell_analysis: addCellAnalysisExecutor,
  update_cell_analysis: updateCellAnalysisExecutor,
  delete_cell_analysis: deleteCellAnalysisExecutor,
  set_pendahuluan: setPendahuluanExecutor,
  set_alat_dan_bahan: setAlatDanBahanExecutor,
  set_step_by_step_narrative: setStepByStepNarrativeExecutor,
  set_code_analysis: setCodeAnalysisExecutor,
  set_pre_test_qa: setPreTestQaExecutor,
  set_post_test_qa: setPostTestQaExecutor,
  set_ulasan_praktikum: setUlasanPraktikumExecutor,
};
