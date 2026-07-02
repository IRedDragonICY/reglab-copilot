import type { AIReportData, CellAnalysis, QAPair, ConclusionParagraph } from '@/lib/types';

/**
 * Raw structure returned by the Gemini `generate_report` function call.
 *
 * The shape is a union of the praktikum declaration (which nests under
 * `praktikum`) and the kuliah declaration (which nests under `kuliah`),
 * so every branch is optional. The merge is defensive against missing
 * keys and empty arrays.
 */
export interface RawToolArgs {
  kuliah?: {
    pendahuluan?: string;
    analisis_hasil?: ConclusionParagraph[];
    cellAnalyses?: CellAnalysis[];
  };
  praktikum?: {
    alat_dan_bahan?: string[];
    langkah_kerja?: string;
    analisis_hasil?: ConclusionParagraph[];
    cellAnalyses?: CellAnalysis[];
    ulasan_praktikum?: string;
  };
  pre_test?: {
    questions?: string[];
    answers?: string[];
  };
  post_test?: {
    questions?: string[];
    answers?: string[];
  };
}

export type MergeMode = 'append' | 'replace' | 'preview';

/**
 * Single source of truth for merging Gemini's `generate_report` output
 * into the authoritative `AIReportData`.
 *
 * Replaces the near-clones `buildTempAiReportData` (streaming preview) and
 * `mergeAiReportData` (post-call authoritative) that used to live in
 * `@/lib/ai-utils`. Semantics per mode:
 *
 * | Field                  | `append`                                        | `replace`                  | `preview`                  |
 * |------------------------|-------------------------------------------------|----------------------------|----------------------------|
 * | `pendahuluan`          | concat with '\n' if both present                | incoming ?? current        | incoming ?? current        |
 * | `preTestAnswers`       | dedupe by `q` over current ∪ incoming           | incoming ?? current        | incoming ?? current        |
 * | `postTestAnswers`      | dedupe by `q` over current ∪ incoming           | incoming ?? current        | incoming ?? current        |
 * | `alatDanBahan`         | incoming if non-empty else current              | incoming ?? current        | incoming ?? current        |
 * | `stepByStepNarrative`  | concat with '\n'                                | incoming ?? current        | incoming ?? current        |
 * | `codeAnalysis`         | concat with '\n'                                | incoming ?? current        | incoming ?? current        |
 * | `cellAnalyses`         | current ∪ incoming (order-preserving append)    | incoming ?? current        | current ∪ incoming         |
 *
 * An empty `incoming` is always a no-op; `current` is returned unchanged.
 */
export function mergeReportData(
  current: AIReportData,
  incoming: RawToolArgs,
  mode: MergeMode = 'append',
): AIReportData {
  const merged: AIReportData = { ...current };

  const incomingPendahuluan = incoming.kuliah?.pendahuluan;
  if (incomingPendahuluan) {
    merged.pendahuluan = concatOrOverwrite(mode, current.pendahuluan, incomingPendahuluan);
  }

  const preTestQs = incoming.pre_test?.questions;
  if (preTestQs && preTestQs.length > 0) {
    const preTestAs = incoming.pre_test?.answers ?? [];
    const newQs = zipQA(preTestQs, preTestAs);
    merged.preTestAnswers = mergeQA(mode, current.preTestAnswers, newQs);
  }

  const postTestQs = incoming.post_test?.questions;
  if (postTestQs && postTestQs.length > 0) {
    const postTestAs = incoming.post_test?.answers ?? [];
    const newQs = zipQA(postTestQs, postTestAs);
    merged.postTestAnswers = mergeQA(mode, current.postTestAnswers, newQs);
  }

  const incomingAlat = incoming.praktikum?.alat_dan_bahan;
  if (incomingAlat && incomingAlat.length > 0) {
    // Original semantics: always overwrite when non-empty, across all modes.
    merged.alatDanBahan = incomingAlat;
  }

  const incomingLangkah = incoming.praktikum?.langkah_kerja;
  if (incomingLangkah) {
    merged.stepByStepNarrative = concatOrOverwrite(
      mode,
      current.stepByStepNarrative,
      incomingLangkah,
    );
  }

  const incomingAnalysis = incoming.kuliah?.analisis_hasil ?? incoming.praktikum?.analisis_hasil;
  if (incomingAnalysis) {
    if (mode === 'replace') {
      merged.codeAnalysis = incomingAnalysis;
    } else {
      const currentArr = Array.isArray(current.codeAnalysis)
        ? current.codeAnalysis
        : (current.codeAnalysis ? [{ teks: current.codeAnalysis }] : []);
      merged.codeAnalysis = [...currentArr, ...incomingAnalysis];
    }
  }

  const incomingCells = incoming.kuliah?.cellAnalyses ?? incoming.praktikum?.cellAnalyses;
  if (incomingCells && incomingCells.length > 0) {
    merged.cellAnalyses = mergeCells(mode, current.cellAnalyses, incomingCells);
  }

  const incomingUlasan = incoming.praktikum?.ulasan_praktikum;
  if (incomingUlasan) {
    if (mode === 'replace') {
      merged.ulasanPraktikum = incomingUlasan;
    } else {
      merged.ulasanPraktikum = current.ulasanPraktikum
        ? `${current.ulasanPraktikum}\n${incomingUlasan}`
        : incomingUlasan;
    }
  }

  return merged;
}

function concatOrOverwrite(
  mode: MergeMode,
  current: string | undefined,
  incoming: string,
): string {
  if (mode !== 'append') return incoming;
  return current ? `${current}\n${incoming}` : incoming;
}

function zipQA(questions: string[], answers: string[]): QAPair[] {
  return questions.map((q, i) => ({ q, a: answers[i] ?? '' }));
}

function mergeQA(mode: MergeMode, current: QAPair[] | undefined, incoming: QAPair[]): QAPair[] {
  if (mode !== 'append') return incoming;
  const combined = [...(current ?? []), ...incoming];
  // Dedupe by `q` — preserve first occurrence order.
  const seen = new Set<string>();
  const out: QAPair[] = [];
  for (const pair of combined) {
    if (seen.has(pair.q)) continue;
    seen.add(pair.q);
    out.push(pair);
  }
  return out;
}

function mergeCells(
  mode: MergeMode,
  current: CellAnalysis[] | undefined,
  incoming: CellAnalysis[],
): CellAnalysis[] {
  if (mode === 'replace') return incoming;
  return [...(current ?? []), ...incoming];
}
