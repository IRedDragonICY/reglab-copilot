import { describe, it, expect } from 'vitest';
import type { CellAnalysis, UserImage } from '@/lib/types';
import { findUnanalyzedImages } from '@/lib/docx/notebook';

/**
 * `findUnanalyzedImages` is the safety net that prevents user-uploaded
 * screenshots from being silently dumped into the report with only a
 * generic caption and no explanation. Pre-fix, an image whose
 * `imageIndex` was never claimed by any `cellAnalyses` entry would still
 * be rendered (under "Lembar Jawaban Post-Test") but with no analysis
 * paragraph beneath — that's the exact failure mode the user reported.
 *
 * The new behaviour: every uploaded implementation/post-test image must
 * appear in *exactly* one of two paths in the document:
 *   1. Linked via a `cellAnalyses[i].imageIndex` (analyzed by the AI).
 *   2. Flagged here as an orphan, in which case the builder renders a
 *      red-italic "Penjelasan Belum Tersedia" notice next to the figure.
 *
 * These tests pin down (1) the matching logic, (2) the section filter,
 * (3) the PDF/empty skip rules, and (4) that orphan ordering preserves
 * the original `images` array index so figures don't get re-shuffled.
 */

const IMG = (id: string, dataUrl = `data:image/png;base64,AAA-${id}`): UserImage => ({
  id,
  dataUrl,
});

const ANALYSIS = (
  imageIndex: number | undefined,
  section: 'implementasi' | 'post_test',
  extras: Partial<CellAnalysis> = {},
): CellAnalysis => ({
  imageIndex,
  section,
  caption: extras.caption ?? 'Caption',
  explanation: extras.explanation ?? 'Explanation',
  ...extras,
});

describe('findUnanalyzedImages', () => {
  it('returns no orphans when every image is claimed by a matching analysis', () => {
    const images = [IMG('a'), IMG('b'), IMG('c')];
    const analyses: CellAnalysis[] = [
      ANALYSIS(0, 'post_test'),
      ANALYSIS(1, 'post_test'),
      ANALYSIS(2, 'post_test'),
    ];
    const orphans = findUnanalyzedImages(images, analyses, 'post_test', 'Lembar Jawaban Post-Test');
    expect(orphans).toEqual([]);
  });

  it('flags every image when no analyses exist (the regression case)', () => {
    const images = [IMG('a'), IMG('b')];
    const orphans = findUnanalyzedImages(images, [], 'post_test', 'Lembar Jawaban Post-Test');
    expect(orphans).toHaveLength(2);
    expect(orphans.map((o) => o.index)).toEqual([0, 1]);
    for (const o of orphans) {
      expect(o.caption).toBe('Lembar Jawaban Post-Test');
      // Warning must mention "Post-Test" so the figure is unambiguous.
      expect(o.warning).toContain('Post-Test');
      expect(o.warning).toContain('Penjelasan');
    }
  });

  it('flags every image when cellAnalyses is undefined (no AI run yet)', () => {
    const images = [IMG('a')];
    const orphans = findUnanalyzedImages(images, undefined, 'implementasi', 'Implementasi');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].warning).toContain('Implementasi');
  });

  it('only flags images whose imageIndex is not claimed', () => {
    const images = [IMG('a'), IMG('b'), IMG('c'), IMG('d')];
    const analyses: CellAnalysis[] = [
      ANALYSIS(1, 'post_test'),
      ANALYSIS(3, 'post_test'),
    ];
    const orphans = findUnanalyzedImages(images, analyses, 'post_test', 'Lembar Jawaban Post-Test');
    expect(orphans.map((o) => o.index)).toEqual([0, 2]);
  });

  it('matches on section so an implementasi analysis cannot claim a post_test image', () => {
    const images = [IMG('a')];
    const analyses: CellAnalysis[] = [ANALYSIS(0, 'implementasi')];
    const orphans = findUnanalyzedImages(images, analyses, 'post_test', 'Lembar Jawaban Post-Test');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].index).toBe(0);
  });

  it('ignores analyses with an undefined imageIndex (cannot map to anything)', () => {
    const images = [IMG('a')];
    const analyses: CellAnalysis[] = [
      ANALYSIS(undefined, 'post_test', { caption: 'Floating analysis' }),
    ];
    const orphans = findUnanalyzedImages(images, analyses, 'post_test', 'Lembar Jawaban Post-Test');
    expect(orphans).toHaveLength(1);
  });

  it('skips images with empty / missing data URLs', () => {
    const images: UserImage[] = [
      IMG('a'),
      { id: 'b', dataUrl: '' },
      // Cast through unknown to model the runtime "image record without dataUrl" we've
      // seen in production payloads from older sessions.
      { id: 'c' } as unknown as UserImage,
    ];
    const orphans = findUnanalyzedImages(images, [], 'post_test', 'X');
    expect(orphans.map((o) => o.index)).toEqual([0]);
  });

  it('skips PDF data URLs (the AI extracted their text already)', () => {
    const images: UserImage[] = [
      IMG('a'),
      { id: 'pdf', dataUrl: 'data:application/pdf;base64,AAA' },
      IMG('b'),
    ];
    const orphans = findUnanalyzedImages(images, [], 'post_test', 'X');
    expect(orphans.map((o) => o.index)).toEqual([0, 2]);
  });

  it('preserves the original index order so figure numbering stays stable', () => {
    const images = [IMG('a'), IMG('b'), IMG('c'), IMG('d'), IMG('e')];
    // Claim 1 and 3, leaving 0, 2, 4 orphaned.
    const analyses: CellAnalysis[] = [
      ANALYSIS(3, 'post_test'),
      ANALYSIS(1, 'post_test'),
    ];
    const orphans = findUnanalyzedImages(images, analyses, 'post_test', 'Lembar Jawaban Post-Test');
    expect(orphans.map((o) => o.index)).toEqual([0, 2, 4]);
  });

  it('uses the bucket caption verbatim so figure labels stay consistent', () => {
    const images = [IMG('a')];
    const orphans = findUnanalyzedImages(
      images,
      [],
      'implementasi',
      'Lampiran Tambahan Implementasi',
    );
    expect(orphans[0].caption).toBe('Lampiran Tambahan Implementasi');
  });

  it('warning text is actionable and mentions both Copilot review and manual edit', () => {
    const images = [IMG('a')];
    const orphans = findUnanalyzedImages(images, [], 'post_test', 'Lembar Jawaban Post-Test');
    const w = orphans[0].warning.toLowerCase();
    expect(w).toContain('copilot');
    expect(w).toContain('manual');
    expect(w).toContain('preview');
  });
});
