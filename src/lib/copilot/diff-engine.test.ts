import { describe, it, expect } from 'vitest';
import {
  computeDiff,
  applyHunk,
  rejectHunk,
  cellAnalysisKey,
} from '@/lib/copilot/diff-engine';
import type {
  Hunk,
  PendingMerge,
} from '@/lib/copilot/types';
import type { AIReportData, CellAnalysis } from '@/lib/types';

/**
 * Validates: Requirements 5.2 (per-field hunks for top-level
 * AIReportData fields), 5.3 (per-entry hunks for cellAnalyses keyed
 * by `(notebookIndex, cellIndex, imageIndex, section)`), 5.5
 * (accept of a single hunk applies only that hunk's changes,
 * implicitly: applying hunks in any order yields the same final
 * state), and 5.6 (reject removes a hunk from the pending merge).
 */

const EMPTY_AI_DATA: AIReportData = {
  preTestAnswers: [],
  postTestAnswers: [],
  stepByStepNarrative: '',
  codeAnalysis: '',
};

const cell = (overrides: Partial<CellAnalysis> = {}): CellAnalysis => ({
  notebookIndex: 0,
  cellIndex: 1,
  imageIndex: 2,
  section: 'implementasi',
  caption: 'caption',
  explanation: 'explanation',
  ...overrides,
});

describe('cellAnalysisKey', () => {
  it('builds the composite key for a fully-indexed entry', () => {
    expect(
      cellAnalysisKey(
        cell({
          notebookIndex: 0,
          cellIndex: 1,
          imageIndex: 2,
          section: 'implementasi',
        }),
      ),
    ).toBe('0-1-2-implementasi');
  });

  it('uses "_" wildcard for missing indices', () => {
    expect(
      cellAnalysisKey({
        section: 'post_test',
        caption: 'c',
        explanation: 'e',
      }),
    ).toBe('_-_-_-post_test');
  });
});

describe('computeDiff', () => {
  it('returns an empty array for deeply-equal snapshots', () => {
    const data: AIReportData = {
      ...EMPTY_AI_DATA,
      pendahuluan: 'intro',
      alatDanBahan: ['A', 'B'],
      preTestAnswers: [{ q: 'q1', a: 'a1' }],
      cellAnalyses: [cell()],
    };
    // Use a deep clone via JSON to ensure structural equality with no
    // shared references.
    const clone: AIReportData = JSON.parse(JSON.stringify(data));
    expect(computeDiff(data, clone)).toEqual([]);
  });

  it('emits one hunk for a string field change with a non-empty lineDiff', () => {
    const base: AIReportData = { ...EMPTY_AI_DATA, pendahuluan: '' };
    const merged: AIReportData = {
      ...EMPTY_AI_DATA,
      pendahuluan: 'New intro',
    };
    const hunks = computeDiff(base, merged);
    expect(hunks).toHaveLength(1);
    const [h] = hunks;
    expect(h.field).toBe('pendahuluan');
    expect(h.id).toBe('field-pendahuluan');
    if (h.field === 'pendahuluan') {
      expect(h.before).toBe('');
      expect(h.after).toBe('New intro');
      expect(h.lineDiff.length).toBeGreaterThan(0);
      expect(h.lineDiff.some((c) => c.added)).toBe(true);
    }
  });

  it('emits one hunk for an alatDanBahan change', () => {
    const base: AIReportData = { ...EMPTY_AI_DATA, alatDanBahan: ['A'] };
    const merged: AIReportData = {
      ...EMPTY_AI_DATA,
      alatDanBahan: ['A', 'B'],
    };
    const hunks = computeDiff(base, merged);
    expect(hunks).toHaveLength(1);
    const [h] = hunks;
    expect(h.field).toBe('alatDanBahan');
    expect(h.id).toBe('field-alatDanBahan');
    if (h.field === 'alatDanBahan') {
      expect(h.before).toEqual(['A']);
      expect(h.after).toEqual(['A', 'B']);
      expect(h.lineDiff.some((c) => c.added)).toBe(true);
    }
  });

  it('emits an "add" hunk for a cellAnalyses entry only present in merged', () => {
    const newEntry = cell({
      notebookIndex: 1,
      cellIndex: 0,
      imageIndex: 0,
      section: 'implementasi',
      caption: 'new',
    });
    const base: AIReportData = { ...EMPTY_AI_DATA, cellAnalyses: [] };
    const merged: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [newEntry],
    };
    const hunks = computeDiff(base, merged);
    expect(hunks).toHaveLength(1);
    const [h] = hunks;
    expect(h.field).toBe('cellAnalyses');
    if (h.field === 'cellAnalyses') {
      expect(h.kind).toBe('add');
      expect(h.entryKey).toBe('1-0-0-implementasi');
      expect(h.after).toEqual(newEntry);
      expect(h.id).toBe('cell-1-0-0-implementasi-add');
    }
  });

  it('emits a "remove" hunk for a cellAnalyses entry only present in base', () => {
    const oldEntry = cell({
      notebookIndex: 2,
      cellIndex: 3,
      imageIndex: 4,
      section: 'post_test',
    });
    const base: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [oldEntry],
    };
    const merged: AIReportData = { ...EMPTY_AI_DATA, cellAnalyses: [] };
    const hunks = computeDiff(base, merged);
    expect(hunks).toHaveLength(1);
    const [h] = hunks;
    expect(h.field).toBe('cellAnalyses');
    if (h.field === 'cellAnalyses') {
      expect(h.kind).toBe('remove');
      expect(h.entryKey).toBe('2-3-4-post_test');
      expect(h.before).toEqual(oldEntry);
    }
  });

  it('emits a "modify" hunk for a cellAnalyses entry whose key matches but content differs', () => {
    const before = cell({ caption: 'old' });
    const after = cell({ caption: 'new' });
    const baseData: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [before],
    };
    const mergedData: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [after],
    };
    const hunks = computeDiff(baseData, mergedData);
    expect(hunks).toHaveLength(1);
    const [h] = hunks;
    expect(h.field).toBe('cellAnalyses');
    if (h.field === 'cellAnalyses') {
      expect(h.kind).toBe('modify');
      expect(h.entryKey).toBe(cellAnalysisKey(before));
      expect(h.before).toEqual(before);
      expect(h.after).toEqual(after);
      expect(h.before).not.toEqual(h.after);
    }
  });
});

describe('applyHunk', () => {
  it('replaces a top-level string field with hunk.after', () => {
    const current: AIReportData = { ...EMPTY_AI_DATA, pendahuluan: 'old' };
    const merged: AIReportData = { ...EMPTY_AI_DATA, pendahuluan: 'new' };
    const [hunk] = computeDiff(current, merged);
    const next = applyHunk(current, hunk);
    expect(next.pendahuluan).toBe('new');
    // Immutability: original untouched.
    expect(current.pendahuluan).toBe('old');
  });

  it('appends a new entry on a cellAnalyses add hunk', () => {
    const newEntry = cell({ caption: 'added' });
    const current: AIReportData = { ...EMPTY_AI_DATA, cellAnalyses: [] };
    const merged: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [newEntry],
    };
    const [hunk] = computeDiff(current, merged);
    const next = applyHunk(current, hunk);
    expect(next.cellAnalyses).toHaveLength(1);
    expect(next.cellAnalyses?.[0]).toEqual(newEntry);
    expect(current.cellAnalyses).toHaveLength(0);
  });

  it('removes the matching entry on a cellAnalyses remove hunk', () => {
    const keep = cell({
      notebookIndex: 0,
      cellIndex: 0,
      imageIndex: 0,
      caption: 'keep',
    });
    const drop = cell({
      notebookIndex: 1,
      cellIndex: 0,
      imageIndex: 0,
      caption: 'drop',
    });
    const current: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [keep, drop],
    };
    const merged: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [keep],
    };
    const [hunk] = computeDiff(current, merged);
    const next = applyHunk(current, hunk);
    expect(next.cellAnalyses).toHaveLength(1);
    expect(next.cellAnalyses?.[0]).toEqual(keep);
  });

  it('replaces the matching entry on a cellAnalyses modify hunk', () => {
    const before = cell({ caption: 'old' });
    const after = cell({ caption: 'new' });
    const current: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [before],
    };
    const merged: AIReportData = {
      ...EMPTY_AI_DATA,
      cellAnalyses: [after],
    };
    const [hunk] = computeDiff(current, merged);
    const next = applyHunk(current, hunk);
    expect(next.cellAnalyses).toHaveLength(1);
    expect(next.cellAnalyses?.[0]).toEqual(after);
  });

  it('is order-independent across distinct top-level fields', () => {
    const base: AIReportData = {
      ...EMPTY_AI_DATA,
      pendahuluan: '',
      alatDanBahan: ['A'],
      cellAnalyses: [],
    };
    const merged: AIReportData = {
      ...EMPTY_AI_DATA,
      pendahuluan: 'New intro',
      alatDanBahan: ['A', 'B'],
      cellAnalyses: [
        cell({
          notebookIndex: 0,
          cellIndex: 0,
          imageIndex: 0,
          caption: 'added',
        }),
      ],
    };
    const hunks = computeDiff(base, merged);
    expect(hunks).toHaveLength(3);

    // Permute three hunks across all 6 orderings; each must produce
    // the same final aiData (the full merged snapshot).
    const orderings: number[][] = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    const results = orderings.map((order) => {
      let acc = base;
      for (const idx of order) {
        acc = applyHunk(acc, hunks[idx]);
      }
      return acc;
    });

    // All six results are deeply equal.
    const stringified = results.map((r) => JSON.stringify(r));
    for (let i = 1; i < stringified.length; i++) {
      expect(stringified[i]).toBe(stringified[0]);
    }
    // And they match the merged snapshot field-by-field.
    expect(results[0].pendahuluan).toBe('New intro');
    expect(results[0].alatDanBahan).toEqual(['A', 'B']);
    expect(results[0].cellAnalyses).toHaveLength(1);
  });
});

describe('rejectHunk', () => {
  const baseHunk: Hunk = {
    id: 'field-pendahuluan',
    field: 'pendahuluan',
    before: '',
    after: 'x',
    lineDiff: [],
  };
  const otherHunk: Hunk = {
    id: 'field-codeAnalysis',
    field: 'codeAnalysis',
    before: '',
    after: 'y',
    lineDiff: [],
  };
  const pending: PendingMerge = {
    id: 'merge-1',
    createdAt: 1000,
    baseSnapshot: EMPTY_AI_DATA,
    mergedSnapshot: { ...EMPTY_AI_DATA, pendahuluan: 'x', codeAnalysis: 'y' },
    hunks: [baseHunk, otherHunk],
    iterationIndex: 1,
  };

  it('removes the matching hunk and returns a new object reference', () => {
    const next = rejectHunk(pending, baseHunk.id);
    expect(next).not.toBe(pending);
    expect(next.hunks).toHaveLength(1);
    expect(next.hunks[0].id).toBe(otherHunk.id);
    // Other fields preserved.
    expect(next.id).toBe(pending.id);
    expect(next.createdAt).toBe(pending.createdAt);
    expect(next.iterationIndex).toBe(pending.iterationIndex);
    expect(next.baseSnapshot).toBe(pending.baseSnapshot);
    expect(next.mergedSnapshot).toBe(pending.mergedSnapshot);
    // Original untouched.
    expect(pending.hunks).toHaveLength(2);
  });

  it('returns the input unchanged (referentially) when the id is missing', () => {
    const next = rejectHunk(pending, 'no-such-id');
    expect(next).toBe(pending);
  });
});
