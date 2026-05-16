import { describe, it, expect } from 'vitest';
import { applyGranularMerge } from '@/lib/ai/tools/granular-merge';
import type { AIReportData, CellAnalysis, QAPair } from '@/lib/types';
import type { GranularPatch } from '@/lib/ai/tools';

/**
 * Validates: Requirements 6.1, 6.9 — the granular write tools apply
 * focused mutations to `AIReportData` and leave unrelated fields
 * untouched. The matcher semantics for `update_cell_analysis` /
 * `delete_cell_analysis` follow Req 6.1: undefined index fields are
 * wildcards, `section` pins the layout slot, and only the first
 * matching entry in document order is touched.
 *
 * These tests cover all 9 `GranularPatch` variants plus matcher edge
 * cases (wildcard match, no match → input unchanged, multiple matches
 * → only first targeted).
 */

const baseCell = (over: Partial<CellAnalysis> = {}): CellAnalysis => ({
  notebookIndex: 0,
  cellIndex: 0,
  imageIndex: undefined,
  section: 'implementasi',
  caption: 'Caption',
  explanation: 'Explanation',
  ...over,
});

const baseReport = (over: Partial<AIReportData> = {}): AIReportData => ({
  pendahuluan: 'pendahuluan-original',
  preTestAnswers: [{ q: 'pre-q', a: 'pre-a' }],
  postTestAnswers: [{ q: 'post-q', a: 'post-a' }],
  stepByStepNarrative: 'narrative-original',
  codeAnalysis: 'code-original',
  alatDanBahan: ['Python', 'Jupyter'],
  cellAnalyses: [],
  ...over,
});

// ---------------------------------------------------------------------------
// add_cell_analysis
// ---------------------------------------------------------------------------

describe('applyGranularMerge — add_cell_analysis', () => {
  it('appends to an existing cellAnalyses array', () => {
    const initial = baseReport({
      cellAnalyses: [baseCell({ caption: 'first' })],
    });
    const entry = baseCell({ cellIndex: 1, caption: 'second' });
    const patch: GranularPatch = { tool: 'add_cell_analysis', entry };

    const next = applyGranularMerge(initial, patch);

    expect(next.cellAnalyses).toEqual([
      baseCell({ caption: 'first' }),
      entry,
    ]);
    // Source array not mutated.
    expect(initial.cellAnalyses).toHaveLength(1);
  });

  it('initializes cellAnalyses when the field is undefined on input', () => {
    const initial = baseReport();
    delete (initial as { cellAnalyses?: CellAnalysis[] }).cellAnalyses;
    const entry = baseCell({ caption: 'fresh' });
    const patch: GranularPatch = { tool: 'add_cell_analysis', entry };

    const next = applyGranularMerge(initial, patch);

    expect(next.cellAnalyses).toEqual([entry]);
  });
});

// ---------------------------------------------------------------------------
// update_cell_analysis
// ---------------------------------------------------------------------------

describe('applyGranularMerge — update_cell_analysis', () => {
  it('patches the first entry whose every defined matcher field matches', () => {
    const cells: CellAnalysis[] = [
      baseCell({ notebookIndex: 0, cellIndex: 0, caption: 'cell-0-0' }),
      baseCell({ notebookIndex: 0, cellIndex: 1, caption: 'cell-0-1' }),
      baseCell({ notebookIndex: 1, cellIndex: 0, caption: 'cell-1-0' }),
    ];
    const initial = baseReport({ cellAnalyses: cells });
    const patch: GranularPatch = {
      tool: 'update_cell_analysis',
      matcher: { notebookIndex: 0, cellIndex: 1, section: 'implementasi' },
      patch: { caption: 'patched' },
    };

    const next = applyGranularMerge(initial, patch);

    expect(next.cellAnalyses?.[0].caption).toBe('cell-0-0');
    expect(next.cellAnalyses?.[1].caption).toBe('patched');
    expect(next.cellAnalyses?.[2].caption).toBe('cell-1-0');
  });

  it('treats undefined matcher index fields as wildcards (section-only matcher)', () => {
    const cells: CellAnalysis[] = [
      baseCell({ section: 'post_test', caption: 'post-first' }),
      baseCell({ section: 'implementasi', caption: 'impl-first' }),
      baseCell({ section: 'implementasi', caption: 'impl-second' }),
    ];
    const initial = baseReport({ cellAnalyses: cells });
    const patch: GranularPatch = {
      tool: 'update_cell_analysis',
      matcher: { section: 'implementasi' },
      patch: { caption: 'wildcard-hit' },
    };

    const next = applyGranularMerge(initial, patch);

    expect(next.cellAnalyses?.[0].caption).toBe('post-first');
    expect(next.cellAnalyses?.[1].caption).toBe('wildcard-hit');
    expect(next.cellAnalyses?.[2].caption).toBe('impl-second');
  });

  it('returns input unchanged when no entry matches', () => {
    const initial = baseReport({
      cellAnalyses: [baseCell({ section: 'implementasi' })],
    });
    const patch: GranularPatch = {
      tool: 'update_cell_analysis',
      matcher: { section: 'post_test' },
      patch: { caption: 'will not apply' },
    };

    const next = applyGranularMerge(initial, patch);

    // Referential equality is the strongest signal; deep-equal is the
    // contract floor.
    expect(next).toBe(initial);
  });

  it('only patches the FIRST matching entry when multiple match', () => {
    const cells: CellAnalysis[] = [
      baseCell({ section: 'implementasi', caption: 'first' }),
      baseCell({ section: 'implementasi', caption: 'second' }),
      baseCell({ section: 'implementasi', caption: 'third' }),
    ];
    const initial = baseReport({ cellAnalyses: cells });
    const patch: GranularPatch = {
      tool: 'update_cell_analysis',
      matcher: { section: 'implementasi' },
      patch: { caption: 'patched' },
    };

    const next = applyGranularMerge(initial, patch);

    expect(next.cellAnalyses?.map((c) => c.caption)).toEqual([
      'patched',
      'second',
      'third',
    ]);
  });
});

// ---------------------------------------------------------------------------
// delete_cell_analysis
// ---------------------------------------------------------------------------

describe('applyGranularMerge — delete_cell_analysis', () => {
  it('removes the first matching entry', () => {
    const cells: CellAnalysis[] = [
      baseCell({ notebookIndex: 0, cellIndex: 0, caption: 'cell-0-0' }),
      baseCell({ notebookIndex: 0, cellIndex: 1, caption: 'cell-0-1' }),
    ];
    const initial = baseReport({ cellAnalyses: cells });
    const patch: GranularPatch = {
      tool: 'delete_cell_analysis',
      matcher: { notebookIndex: 0, cellIndex: 0, section: 'implementasi' },
    };

    const next = applyGranularMerge(initial, patch);

    expect(next.cellAnalyses).toHaveLength(1);
    expect(next.cellAnalyses?.[0].caption).toBe('cell-0-1');
  });

  it('returns input unchanged when no entry matches', () => {
    const initial = baseReport({
      cellAnalyses: [baseCell({ section: 'implementasi' })],
    });
    const patch: GranularPatch = {
      tool: 'delete_cell_analysis',
      matcher: { section: 'post_test' },
    };

    const next = applyGranularMerge(initial, patch);

    expect(next).toBe(initial);
  });

  it('only removes the FIRST matching entry when multiple match', () => {
    const cells: CellAnalysis[] = [
      baseCell({ section: 'implementasi', caption: 'first' }),
      baseCell({ section: 'implementasi', caption: 'second' }),
      baseCell({ section: 'implementasi', caption: 'third' }),
    ];
    const initial = baseReport({ cellAnalyses: cells });
    const patch: GranularPatch = {
      tool: 'delete_cell_analysis',
      matcher: { section: 'implementasi' },
    };

    const next = applyGranularMerge(initial, patch);

    expect(next.cellAnalyses?.map((c) => c.caption)).toEqual([
      'second',
      'third',
    ]);
  });
});

// ---------------------------------------------------------------------------
// set_pendahuluan
// ---------------------------------------------------------------------------

describe('applyGranularMerge — set_pendahuluan', () => {
  it('replaces pendahuluan and leaves other fields untouched', () => {
    const initial = baseReport();
    const patch: GranularPatch = { tool: 'set_pendahuluan', text: 'new pendahuluan' };

    const next = applyGranularMerge(initial, patch);

    expect(next.pendahuluan).toBe('new pendahuluan');
    expect(next.preTestAnswers).toBe(initial.preTestAnswers);
    expect(next.postTestAnswers).toBe(initial.postTestAnswers);
    expect(next.stepByStepNarrative).toBe(initial.stepByStepNarrative);
    expect(next.codeAnalysis).toBe(initial.codeAnalysis);
    expect(next.alatDanBahan).toBe(initial.alatDanBahan);
    expect(next.cellAnalyses).toBe(initial.cellAnalyses);
  });
});

// ---------------------------------------------------------------------------
// set_alat_dan_bahan
// ---------------------------------------------------------------------------

describe('applyGranularMerge — set_alat_dan_bahan', () => {
  it('replaces alatDanBahan without mutating the original input', () => {
    const initial = baseReport({ alatDanBahan: ['Old1', 'Old2'] });
    const initialAlatRef = initial.alatDanBahan;
    const items = ['Python', 'Jupyter Notebook', 'Pandas'];
    const patch: GranularPatch = { tool: 'set_alat_dan_bahan', items };

    const next = applyGranularMerge(initial, patch);

    expect(next.alatDanBahan).toEqual(items);
    // Original snapshot is untouched.
    expect(initial.alatDanBahan).toBe(initialAlatRef);
    expect(initial.alatDanBahan).toEqual(['Old1', 'Old2']);
  });
});

// ---------------------------------------------------------------------------
// set_step_by_step_narrative
// ---------------------------------------------------------------------------

describe('applyGranularMerge — set_step_by_step_narrative', () => {
  it('replaces the narrative field', () => {
    const initial = baseReport();
    const patch: GranularPatch = {
      tool: 'set_step_by_step_narrative',
      text: 'step 1; step 2; step 3',
    };

    const next = applyGranularMerge(initial, patch);

    expect(next.stepByStepNarrative).toBe('step 1; step 2; step 3');
    expect(next.codeAnalysis).toBe(initial.codeAnalysis);
  });
});

// ---------------------------------------------------------------------------
// set_code_analysis
// ---------------------------------------------------------------------------

describe('applyGranularMerge — set_code_analysis', () => {
  it('replaces the code analysis field', () => {
    const initial = baseReport();
    const patch: GranularPatch = {
      tool: 'set_code_analysis',
      text: 'updated code analysis',
    };

    const next = applyGranularMerge(initial, patch);

    expect(next.codeAnalysis).toBe('updated code analysis');
    expect(next.stepByStepNarrative).toBe(initial.stepByStepNarrative);
  });
});

// ---------------------------------------------------------------------------
// set_pre_test_qa / set_post_test_qa
// ---------------------------------------------------------------------------

describe('applyGranularMerge — set_pre_test_qa', () => {
  it('replaces preTestAnswers and leaves postTestAnswers untouched', () => {
    const initial = baseReport();
    const initialPostRef = initial.postTestAnswers;
    const pairs: QAPair[] = [
      { q: 'new q1', a: 'new a1' },
      { q: 'new q2', a: 'new a2' },
    ];
    const patch: GranularPatch = { tool: 'set_pre_test_qa', pairs };

    const next = applyGranularMerge(initial, patch);

    expect(next.preTestAnswers).toEqual(pairs);
    expect(next.postTestAnswers).toBe(initialPostRef);
  });
});

describe('applyGranularMerge — set_post_test_qa', () => {
  it('replaces postTestAnswers and leaves preTestAnswers untouched', () => {
    const initial = baseReport();
    const initialPreRef = initial.preTestAnswers;
    const pairs: QAPair[] = [{ q: 'post q', a: 'post a' }];
    const patch: GranularPatch = { tool: 'set_post_test_qa', pairs };

    const next = applyGranularMerge(initial, patch);

    expect(next.postTestAnswers).toEqual(pairs);
    expect(next.preTestAnswers).toBe(initialPreRef);
  });
});


// ---------------------------------------------------------------------------
// Granular tool executors (task 9.2)
// ---------------------------------------------------------------------------

import {
  addCellAnalysisExecutor,
  updateCellAnalysisExecutor,
  deleteCellAnalysisExecutor,
  setPendahuluanExecutor,
  setAlatDanBahanExecutor,
  setStepByStepNarrativeExecutor,
  setCodeAnalysisExecutor,
  setPreTestQaExecutor,
  setPostTestQaExecutor,
  GRANULAR_EXECUTORS,
} from '@/lib/ai/tools/granular-merge';
import { TOOL_REGISTRY } from '@/lib/ai/tools';
import type { ToolExecutionContext } from '@/lib/ai/tools';

/**
 * Validates: Requirements 6.1, 6.9 — granular tool executors wrap
 * validated args into a `GranularPatch` and surface validation
 * failures as `{ kind: 'noop', reason }` rather than throwing. The
 * registry is populated on module load so the agent loop can
 * dispatch without an extra wiring step.
 */

// Executors don't read from `ctx` for the granular write tools, but
// the contract still requires it — pass an empty stub.
const ctx: ToolExecutionContext = {
  images: { pre_test: [], implementasi: [], post_test: [], notebook: [] },
  notebooks: [],
  aiData: baseReport(),
};

describe('granular executors — add_cell_analysis', () => {
  it('returns { kind: "merge", patch } for a valid entry', () => {
    const entry = baseCell({ caption: 'valid', explanation: 'detail' });
    const result = addCellAnalysisExecutor.execute({ entry }, ctx);

    expect(result).toEqual({
      kind: 'merge',
      patch: { tool: 'add_cell_analysis', entry },
    });
  });

  it('returns { kind: "noop", reason } when entry.section is missing', () => {
    const entry = { caption: 'c', explanation: 'e' }; // no section
    const result = addCellAnalysisExecutor.execute({ entry }, ctx);

    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') expect(result.reason).toMatch(/section/);
  });

  it('returns { kind: "noop", reason } when entry is null', () => {
    const result = addCellAnalysisExecutor.execute({ entry: null }, ctx);

    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') expect(result.reason).toMatch(/entry is required/);
  });
});

describe('granular executors — update_cell_analysis', () => {
  it('returns { kind: "merge", patch } for a valid matcher + patch', () => {
    const matcher = { section: 'implementasi', notebookIndex: 0, cellIndex: 1 } as const;
    const patch = { caption: 'updated' };
    const result = updateCellAnalysisExecutor.execute({ matcher, patch }, ctx);

    expect(result).toEqual({
      kind: 'merge',
      patch: { tool: 'update_cell_analysis', matcher, patch },
    });
  });

  it('returns { kind: "noop", reason } when matcher is missing section', () => {
    const matcher = { notebookIndex: 0 }; // no section
    const result = updateCellAnalysisExecutor.execute({ matcher, patch: { caption: 'x' } }, ctx);

    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') expect(result.reason).toMatch(/matcher is invalid/);
  });
});

describe('granular executors — set_pendahuluan', () => {
  it('returns { kind: "noop" } when text is not a string', () => {
    const result = setPendahuluanExecutor.execute({ text: 42 }, ctx);

    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') expect(result.reason).toMatch(/text must be a string/);
  });
});

describe('granular executors — set_alat_dan_bahan', () => {
  it('returns { kind: "noop" } when items is not an array', () => {
    const result = setAlatDanBahanExecutor.execute({ items: 'not-an-array' }, ctx);

    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') expect(result.reason).toMatch(/string\[\]/);
  });
});

describe('granular executors — set_pre_test_qa', () => {
  it('returns { kind: "noop" } when a pair is missing required fields', () => {
    const pairs = [
      { q: 'valid q', a: 'valid a' },
      { q: 'just q' }, // missing `a`
    ];
    const result = setPreTestQaExecutor.execute({ pairs }, ctx);

    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') expect(result.reason).toMatch(/q, a/);
  });
});

describe('granular executors — TOOL_REGISTRY wiring', () => {
  it('TOOL_REGISTRY.executors.add_cell_analysis is the addCellAnalysisExecutor', () => {
    expect(TOOL_REGISTRY.executors.add_cell_analysis).toBe(addCellAnalysisExecutor);
  });

  it('TOOL_REGISTRY.executors contains all 9 granular tool names', () => {
    const expected = [
      'add_cell_analysis',
      'update_cell_analysis',
      'delete_cell_analysis',
      'set_pendahuluan',
      'set_alat_dan_bahan',
      'set_step_by_step_narrative',
      'set_code_analysis',
      'set_pre_test_qa',
      'set_post_test_qa',
    ];
    const keys = Object.keys(TOOL_REGISTRY.executors);
    for (const name of expected) {
      expect(keys).toContain(name);
    }
  });

  it('GRANULAR_EXECUTORS aggregator references the named executors', () => {
    expect(GRANULAR_EXECUTORS.add_cell_analysis).toBe(addCellAnalysisExecutor);
    expect(GRANULAR_EXECUTORS.update_cell_analysis).toBe(updateCellAnalysisExecutor);
    expect(GRANULAR_EXECUTORS.delete_cell_analysis).toBe(deleteCellAnalysisExecutor);
    expect(GRANULAR_EXECUTORS.set_pendahuluan).toBe(setPendahuluanExecutor);
    expect(GRANULAR_EXECUTORS.set_alat_dan_bahan).toBe(setAlatDanBahanExecutor);
    expect(GRANULAR_EXECUTORS.set_step_by_step_narrative).toBe(setStepByStepNarrativeExecutor);
    expect(GRANULAR_EXECUTORS.set_code_analysis).toBe(setCodeAnalysisExecutor);
    expect(GRANULAR_EXECUTORS.set_pre_test_qa).toBe(setPreTestQaExecutor);
    expect(GRANULAR_EXECUTORS.set_post_test_qa).toBe(setPostTestQaExecutor);
  });
});
