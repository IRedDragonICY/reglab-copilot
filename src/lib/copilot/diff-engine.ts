/**
 * Diff engine for the Copilot agent upgrade.
 *
 * Pure functions that compute, apply, and reject {@link Hunk}s
 * between two `AIReportData` snapshots. The engine is the
 * computational core of Auto_Accept_Mode = OFF (Req 5): when a
 * merge is held in `pendingMerge`, the UI renders these hunks and
 * the user accepts or rejects them per top-level field (or per
 * `cellAnalyses` entry).
 *
 * Design notes:
 *   - Order-independence (Req 5.5): {@link applyHunk} produces the
 *     same final `aiData` regardless of the order in which a set of
 *     hunks targeting different fields is applied. Per-`cellAnalyses`
 *     hunks are keyed by `entryKey` so they don't collide with each
 *     other; non-cellAnalyses hunks all target distinct top-level
 *     fields by construction in {@link computeDiff}.
 *   - Immutability: every public function returns new objects;
 *     inputs are never mutated.
 *   - Equality: structural comparison uses `JSON.stringify`. This is
 *     sufficient because `AIReportData` is JSON-serializable by
 *     contract (it's persisted in IndexedDB).
 *   - String diffs: `diffLines` from the `diff` package (added in
 *     task 16.1). The package's `Change` shape is structurally
 *     compatible with our local {@link LineChange} type.
 */

import { diffLines } from 'diff';
import type {
  Hunk,
  PendingMerge,
  CellAnalysisKey,
  QAPairDiff,
  LineChange,
} from '@/lib/copilot/types';
import type { AIReportData, CellAnalysis, QAPair } from '@/lib/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Structural equality via JSON serialization. */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Build the entryKey for a `cellAnalysis`. Used to key per-entry
 * hunks so that adds/removes/modifies on different entries don't
 * conflict when applied in arbitrary order.
 *
 * Missing notebook/cell/image indices become the literal `'_'`
 * wildcard so callers can distinguish a synthesized entry (e.g. a
 * post-test answer with no notebook context) from one that simply
 * has `notebookIndex: 0`.
 */
export function cellAnalysisKey(entry: CellAnalysis): CellAnalysisKey {
  const n = entry.notebookIndex ?? '_';
  const c = entry.cellIndex ?? '_';
  const i = entry.imageIndex ?? '_';
  return `${n}-${c}-${i}-${entry.section}` as CellAnalysisKey;
}

// ---------------------------------------------------------------------------
// computeDiff
// ---------------------------------------------------------------------------

/**
 * Compute hunks between two `AIReportData` snapshots.
 *
 * Returns an empty array iff the snapshots are deeply equal field
 * by field. Hunks are emitted per top-level field per Req 5.2, with
 * `cellAnalyses` further split per entry per Req 5.3.
 *
 * The order of the returned hunks is stable but not load-bearing —
 * {@link applyHunk} composes commutatively across distinct top-level
 * fields and across distinct `cellAnalyses` entry keys.
 */
export function computeDiff(base: AIReportData, merged: AIReportData): Hunk[] {
  const hunks: Hunk[] = [];

  // --- string fields ------------------------------------------------------
  const stringFields = [
    'pendahuluan',
    'stepByStepNarrative',
  ] as const;
  for (const field of stringFields) {
    const beforeRaw = base[field];
    const afterRaw = merged[field];
    if (beforeRaw === afterRaw) continue;
    const before = beforeRaw ?? '';
    const after = afterRaw ?? '';
    hunks.push({
      id: `field-${field}`,
      field,
      before,
      after,
      lineDiff: diffLines(before, after) as LineChange[],
    });
  }

  // --- codeAnalysis --------------------------------------------------------
  if (!jsonEqual(base.codeAnalysis, merged.codeAnalysis)) {
    const beforeRaw = base.codeAnalysis;
    const afterRaw = merged.codeAnalysis;
    const beforeStr = typeof beforeRaw === 'string' ? beforeRaw : (beforeRaw ? JSON.stringify(beforeRaw, null, 2) : '');
    const afterStr = typeof afterRaw === 'string' ? afterRaw : (afterRaw ? JSON.stringify(afterRaw, null, 2) : '');
    hunks.push({
      id: 'field-codeAnalysis',
      field: 'codeAnalysis',
      before: beforeRaw ?? '',
      after: afterRaw ?? '',
      lineDiff: diffLines(beforeStr, afterStr) as LineChange[],
    });
  }

  // --- alatDanBahan (string[]) -------------------------------------------
  if (!jsonEqual(base.alatDanBahan, merged.alatDanBahan)) {
    const before = base.alatDanBahan ?? [];
    const after = merged.alatDanBahan ?? [];
    hunks.push({
      id: 'field-alatDanBahan',
      field: 'alatDanBahan',
      before,
      after,
      lineDiff: diffLines(before.join('\n'), after.join('\n')) as LineChange[],
    });
  }

  // --- preTestAnswers / postTestAnswers (QAPair[]) ------------------------
  const qaFields = ['preTestAnswers', 'postTestAnswers'] as const;
  for (const field of qaFields) {
    const before = base[field] ?? [];
    const after = merged[field] ?? [];
    if (jsonEqual(before, after)) continue;
    hunks.push({
      id: `field-${field}`,
      field,
      before,
      after,
      pairDiffs: computePairDiffs(before, after),
    });
  }

  // --- cellAnalyses (CellAnalysis[]) per Req 5.3 --------------------------
  const baseCells = base.cellAnalyses ?? [];
  const mergedCells = merged.cellAnalyses ?? [];

  // Bucket entries by key so we can detect collisions (multiple
  // entries with the same key) and disambiguate hunk ids by index.
  const baseByKey = new Map<CellAnalysisKey, CellAnalysis[]>();
  for (const entry of baseCells) {
    const key = cellAnalysisKey(entry);
    const list = baseByKey.get(key) ?? [];
    list.push(entry);
    baseByKey.set(key, list);
  }
  const mergedByKey = new Map<CellAnalysisKey, CellAnalysis[]>();
  for (const entry of mergedCells) {
    const key = cellAnalysisKey(entry);
    const list = mergedByKey.get(key) ?? [];
    list.push(entry);
    mergedByKey.set(key, list);
  }

  // Stable iteration order: keys appear first in their merged-side
  // position, then any remaining keys from the base side. We
  // recompute order from the source arrays so two runs over the same
  // input yield identical hunk ordering.
  const seen = new Set<CellAnalysisKey>();
  const orderedKeys: CellAnalysisKey[] = [];
  for (const entry of mergedCells) {
    const key = cellAnalysisKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      orderedKeys.push(key);
    }
  }
  for (const entry of baseCells) {
    const key = cellAnalysisKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      orderedKeys.push(key);
    }
  }

  for (const key of orderedKeys) {
    const baseList = baseByKey.get(key) ?? [];
    const mergedList = mergedByKey.get(key) ?? [];
    const maxLen = Math.max(baseList.length, mergedList.length);
    const collision = maxLen > 1;

    for (let i = 0; i < maxLen; i++) {
      const b = baseList[i];
      const m = mergedList[i];
      if (b === undefined && m !== undefined) {
        hunks.push({
          id: collision
            ? `cell-${key}-add-${i}`
            : `cell-${key}-add`,
          field: 'cellAnalyses',
          entryKey: key,
          kind: 'add',
          after: m,
        });
      } else if (b !== undefined && m === undefined) {
        hunks.push({
          id: collision
            ? `cell-${key}-remove-${i}`
            : `cell-${key}-remove`,
          field: 'cellAnalyses',
          entryKey: key,
          kind: 'remove',
          before: b,
        });
      } else if (b !== undefined && m !== undefined && !jsonEqual(b, m)) {
        hunks.push({
          id: collision
            ? `cell-${key}-modify-${i}`
            : `cell-${key}-modify`,
          field: 'cellAnalyses',
          entryKey: key,
          kind: 'modify',
          before: b,
          after: m,
        });
      }
      // both defined and equal → no hunk
    }
  }

  return hunks;
}

/**
 * Walk two `QAPair[]` index-by-index up to `max(before.length,
 * after.length)` and emit one {@link QAPairDiff} per index.
 */
function computePairDiffs(before: QAPair[], after: QAPair[]): QAPairDiff[] {
  const max = Math.max(before.length, after.length);
  const diffs: QAPairDiff[] = [];
  for (let i = 0; i < max; i++) {
    const b = before[i];
    const a = after[i];
    if (b === undefined) {
      diffs.push({ index: i, kind: 'add', after: a });
    } else if (a === undefined) {
      diffs.push({ index: i, kind: 'remove', before: b });
    } else if (jsonEqual(b, a)) {
      diffs.push({ index: i, kind: 'unchanged', before: b, after: a });
    } else {
      diffs.push({ index: i, kind: 'modify', before: b, after: a });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// applyHunk
// ---------------------------------------------------------------------------

/**
 * Apply a single hunk to the current `AIReportData` and return a
 * new `AIReportData` with that hunk's changes.
 *
 * Order-independence (Req 5.5): applying a set of hunks in any order
 * produces the same final state as long as no two hunks target the
 * same field. Per-`cellAnalyses` hunks are keyed by entryKey so
 * adds/removes/modifies on different entries do not collide.
 *
 * For `cellAnalyses` modify/remove on a list with multiple entries
 * sharing the same `entryKey` (collision case), only the first
 * matching entry is mutated. Callers that emit collision hunks via
 * `computeDiff`'s indexed ids must apply hunks in increasing-index
 * order to land each hunk on the correct entry.
 */
export function applyHunk(current: AIReportData, hunk: Hunk): AIReportData {
  switch (hunk.field) {
    case 'pendahuluan':
    case 'stepByStepNarrative':
    case 'codeAnalysis':
      return { ...current, [hunk.field]: hunk.after };

    case 'alatDanBahan':
      return { ...current, alatDanBahan: hunk.after };

    case 'preTestAnswers':
    case 'postTestAnswers':
      return { ...current, [hunk.field]: hunk.after };

    case 'cellAnalyses': {
      const cells = current.cellAnalyses ?? [];
      if (hunk.kind === 'add') {
        if (!hunk.after) return current;
        return { ...current, cellAnalyses: [...cells, hunk.after] };
      }
      if (hunk.kind === 'remove') {
        let removed = false;
        const next = cells.filter((entry) => {
          if (!removed && cellAnalysisKey(entry) === hunk.entryKey) {
            removed = true;
            return false;
          }
          return true;
        });
        return { ...current, cellAnalyses: next };
      }
      // modify
      if (!hunk.after) return current;
      let replaced = false;
      const next = cells.map((entry) => {
        if (!replaced && cellAnalysisKey(entry) === hunk.entryKey) {
          replaced = true;
          return hunk.after!;
        }
        return entry;
      });
      return { ...current, cellAnalyses: next };
    }
  }
}

// ---------------------------------------------------------------------------
// rejectHunk
// ---------------------------------------------------------------------------

/**
 * Remove a hunk from a {@link PendingMerge} by id without applying
 * it. Returns a new `PendingMerge` object (immutable).
 *
 * If `hunkId` does not match any hunk, the input is returned
 * unchanged — no throw, so the UI can race against another reject
 * landing first without wrapping every action in a try/catch.
 */
export function rejectHunk(
  pending: PendingMerge,
  hunkId: string,
): PendingMerge {
  const exists = pending.hunks.some((h) => h.id === hunkId);
  if (!exists) return pending;
  return {
    ...pending,
    hunks: pending.hunks.filter((h) => h.id !== hunkId),
  };
}
