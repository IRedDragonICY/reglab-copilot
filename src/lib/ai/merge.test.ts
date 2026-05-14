import { describe, it, expect } from 'vitest';
import { mergeReportData, type RawToolArgs } from '@/lib/ai/merge';
import type { AIReportData } from '@/lib/types';

const empty: AIReportData = {
  preTestAnswers: [],
  postTestAnswers: [],
  stepByStepNarrative: '',
  codeAnalysis: '',
  alatDanBahan: [],
  cellAnalyses: [],
  pendahuluan: '',
};

describe('mergeReportData — empty incoming is a no-op', () => {
  it.each(['append', 'replace', 'preview'] as const)('mode=%s', (mode) => {
    const out = mergeReportData(empty, {}, mode);
    expect(out).toEqual(empty);
    // Returns a new object, not the same reference.
    expect(out).not.toBe(empty);
  });
});

describe('mergeReportData — pendahuluan', () => {
  const incoming: RawToolArgs = { kuliah: { pendahuluan: 'NEW' } };

  it('append concatenates with \\n when current is non-empty', () => {
    const out = mergeReportData({ ...empty, pendahuluan: 'OLD' }, incoming, 'append');
    expect(out.pendahuluan).toBe('OLD\nNEW');
  });

  it('append uses incoming when current is empty', () => {
    const out = mergeReportData(empty, incoming, 'append');
    expect(out.pendahuluan).toBe('NEW');
  });

  it('replace overwrites current', () => {
    const out = mergeReportData({ ...empty, pendahuluan: 'OLD' }, incoming, 'replace');
    expect(out.pendahuluan).toBe('NEW');
  });

  it('preview overwrites current', () => {
    const out = mergeReportData({ ...empty, pendahuluan: 'OLD' }, incoming, 'preview');
    expect(out.pendahuluan).toBe('NEW');
  });
});

describe('mergeReportData — preTestAnswers / postTestAnswers', () => {
  const incoming: RawToolArgs = {
    pre_test: { questions: ['Q1', 'Q2'], answers: ['A1', 'A2'] },
    post_test: { questions: ['PQ1'], answers: ['PA1'] },
  };

  it('append merges and dedupes by question text', () => {
    const base: AIReportData = {
      ...empty,
      preTestAnswers: [{ q: 'Q1', a: 'OLD-A1' }],
    };
    const out = mergeReportData(base, incoming, 'append');
    expect(out.preTestAnswers).toEqual([
      { q: 'Q1', a: 'OLD-A1' }, // existing Q1 preserved (first-seen wins)
      { q: 'Q2', a: 'A2' },
    ]);
  });

  it('append handles missing answers gracefully with empty strings', () => {
    const onlyQs: RawToolArgs = { pre_test: { questions: ['X'] } };
    const out = mergeReportData(empty, onlyQs, 'append');
    expect(out.preTestAnswers).toEqual([{ q: 'X', a: '' }]);
  });

  it('replace overwrites existing list', () => {
    const base: AIReportData = {
      ...empty,
      preTestAnswers: [{ q: 'OLD', a: 'X' }],
    };
    const out = mergeReportData(base, incoming, 'replace');
    expect(out.preTestAnswers).toEqual([
      { q: 'Q1', a: 'A1' },
      { q: 'Q2', a: 'A2' },
    ]);
  });

  it('empty questions array is a no-op', () => {
    const out = mergeReportData(empty, { pre_test: { questions: [], answers: [] } }, 'append');
    expect(out.preTestAnswers).toEqual([]);
  });
});

describe('mergeReportData — alatDanBahan', () => {
  it('overwrites with non-empty incoming regardless of mode', () => {
    const base: AIReportData = { ...empty, alatDanBahan: ['existing'] };
    const incoming: RawToolArgs = { praktikum: { alat_dan_bahan: ['fresh'] } };
    expect(mergeReportData(base, incoming, 'append').alatDanBahan).toEqual(['fresh']);
    expect(mergeReportData(base, incoming, 'replace').alatDanBahan).toEqual(['fresh']);
    expect(mergeReportData(base, incoming, 'preview').alatDanBahan).toEqual(['fresh']);
  });

  it('empty incoming leaves current alone', () => {
    const base: AIReportData = { ...empty, alatDanBahan: ['existing'] };
    const out = mergeReportData(base, { praktikum: { alat_dan_bahan: [] } }, 'append');
    expect(out.alatDanBahan).toEqual(['existing']);
  });
});

describe('mergeReportData — stepByStepNarrative and codeAnalysis', () => {
  it('append concatenates with \\n; replace overwrites', () => {
    const base: AIReportData = {
      ...empty,
      stepByStepNarrative: 'OLD',
      codeAnalysis: 'OLD-ANALYSIS',
    };
    const incoming: RawToolArgs = {
      praktikum: { langkah_kerja: 'NEW', analisis_hasil: 'NEW-ANALYSIS' },
    };
    const appended = mergeReportData(base, incoming, 'append');
    expect(appended.stepByStepNarrative).toBe('OLD\nNEW');
    expect(appended.codeAnalysis).toBe('OLD-ANALYSIS\nNEW-ANALYSIS');
    const replaced = mergeReportData(base, incoming, 'replace');
    expect(replaced.stepByStepNarrative).toBe('NEW');
    expect(replaced.codeAnalysis).toBe('NEW-ANALYSIS');
  });

  it('kuliah analisis_hasil takes precedence when both kuliah and praktikum are present', () => {
    const incoming: RawToolArgs = {
      kuliah: { analisis_hasil: 'KULIAH' },
      praktikum: { analisis_hasil: 'PRAKTIKUM' },
    };
    const out = mergeReportData(empty, incoming, 'append');
    expect(out.codeAnalysis).toBe('KULIAH');
  });
});

describe('mergeReportData — cellAnalyses', () => {
  const firstBatch = [
    { cellIndex: 0, section: 'implementasi', caption: 'C1', explanation: 'E1' },
  ] as const;
  const secondBatch = [
    { cellIndex: 1, section: 'implementasi', caption: 'C2', explanation: 'E2' },
  ] as const;

  it('append preserves order: current followed by incoming', () => {
    const base: AIReportData = { ...empty, cellAnalyses: [...firstBatch] };
    const out = mergeReportData(
      base,
      { praktikum: { cellAnalyses: [...secondBatch] } },
      'append',
    );
    expect(out.cellAnalyses).toEqual([...firstBatch, ...secondBatch]);
  });

  it('preview also appends (keeps batch-safe accumulation during streaming)', () => {
    const base: AIReportData = { ...empty, cellAnalyses: [...firstBatch] };
    const out = mergeReportData(
      base,
      { praktikum: { cellAnalyses: [...secondBatch] } },
      'preview',
    );
    expect(out.cellAnalyses).toEqual([...firstBatch, ...secondBatch]);
  });

  it('replace discards current', () => {
    const base: AIReportData = { ...empty, cellAnalyses: [...firstBatch] };
    const out = mergeReportData(
      base,
      { praktikum: { cellAnalyses: [...secondBatch] } },
      'replace',
    );
    expect(out.cellAnalyses).toEqual([...secondBatch]);
  });

  it('kuliah.cellAnalyses takes precedence over praktikum.cellAnalyses', () => {
    const out = mergeReportData(
      empty,
      {
        kuliah: { cellAnalyses: [{ section: 'implementasi', caption: 'K', explanation: 'K' }] },
        praktikum: { cellAnalyses: [{ section: 'implementasi', caption: 'P', explanation: 'P' }] },
      },
      'append',
    );
    expect(out.cellAnalyses).toEqual([{ section: 'implementasi', caption: 'K', explanation: 'K' }]);
  });
});
