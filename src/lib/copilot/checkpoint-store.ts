/**
 * Checkpoint store: pure functions that own the lifecycle of a
 * `Checkpoint[]` array on a `ReportSession`.
 *
 * The store has three responsibilities:
 *
 *   1. **Create** an immutable snapshot from the current Copilot
 *      state.  See {@link createCheckpoint}.
 *   2. **Evict** the oldest auto-checkpoints when the array exceeds
 *      the configured cap.  Manual checkpoints are pinned and never
 *      evicted, even if that means the cap is intentionally
 *      exceeded.  See {@link evictIfOverCap}.
 *   3. **Revert** to a chosen checkpoint by truncating later
 *      entries while preserving the chosen one.  See
 *      {@link revertToCheckpoint}.
 *
 * Every function is pure: no mutation of the inputs, no I/O, no
 * `Date.now()` or `crypto.randomUUID()` outside of `createCheckpoint`
 * which exists precisely to mint those values.
 *
 * Mapping from spec acceptance criteria:
 *   - Req 4.1 — auto checkpoints are immutable; we freeze every
 *     created object so accidental mutation throws in strict mode.
 *   - Req 4.3 — 50-cap eviction with manual pinning is enforced
 *     entirely inside {@link evictIfOverCap}.
 *   - Req 4.5 — revert preserves `[0..K]` (including the chosen one)
 *     and discards `[K+1..N]`.
 */

import type {
  Checkpoint,
  CopilotMessage,
  LoopCursor,
} from '@/lib/copilot/types';
import type { AIReportData } from '@/lib/types';
import { generateId } from '@/lib/utils';

/** Default per-session checkpoint cap (Req 4.3). */
export const DEFAULT_CHECKPOINT_CAP = 50;

/**
 * Mint a new {@link Checkpoint} from the supplied state.
 *
 * Snapshots are stored **as-is**: callers are responsible for passing
 * already-snapshotted state.  This module deliberately avoids
 * `structuredClone` because:
 *
 *   - The hook layer (`useCopilotAI`) holds the canonical references
 *     and decides cloning policy — cloning twice would waste memory
 *     on every iteration.
 *   - Some snapshot inputs (e.g. `loopCursor.contents` carrying
 *     `inlineData` for images) are very large; cloning here would
 *     amplify per-checkpoint cost.
 *
 * The returned object is `Object.freeze`d to honor the immutability
 * contract from Req 4.1.  Note: `Object.freeze` is shallow.  Nested
 * arrays and objects (e.g. `aiDataSnapshot.cellAnalyses`) remain
 * mutable in JavaScript terms; the top-level seal is sufficient to
 * catch accidental reassignment of `id`, `createdAt`, or
 * `*Snapshot` fields, which is what callers actually do by mistake.
 */
export function createCheckpoint(opts: {
  source: 'auto' | 'manual';
  label: string;
  aiData: AIReportData;
  chatHistory: CopilotMessage[];
  loopCursor: LoopCursor | null;
}): Checkpoint {
  const checkpoint: Checkpoint = {
    id: generateId(),
    createdAt: Date.now(),
    label: opts.label,
    source: opts.source,
    aiDataSnapshot: opts.aiData,
    chatHistorySnapshot: opts.chatHistory,
    loopCursorSnapshot: opts.loopCursor,
  };
  return Object.freeze(checkpoint);
}

/**
 * Trim a checkpoint array down to `cap` entries by removing the
 * oldest auto-checkpoints first.  Manual checkpoints are pinned and
 * never evicted; if the array contains more than `cap` manual
 * checkpoints the cap is intentionally exceeded (Req 4.3).
 *
 * The function is non-mutating.  If the input is already at or below
 * cap, the same array reference is returned so callers can use a
 * referential-equality check to detect "nothing changed" without
 * walking the array.
 */
export function evictIfOverCap(
  checkpoints: Checkpoint[],
  cap: number = DEFAULT_CHECKPOINT_CAP,
): Checkpoint[] {
  if (checkpoints.length <= cap) {
    return checkpoints;
  }

  // Build a list of `auto` indices ordered oldest → newest.  We sort
  // by `createdAt` rather than trusting array order because the
  // session may have been hand-edited or imported from a backup.
  const autoIndices = checkpoints
    .map((cp, idx) => ({ cp, idx }))
    .filter(({ cp }) => cp.source === 'auto')
    .sort((a, b) => a.cp.createdAt - b.cp.createdAt)
    .map(({ idx }) => idx);

  // Mark indices to drop until length fits or no auto remains.
  const toDrop = new Set<number>();
  let projectedLen = checkpoints.length;
  for (const idx of autoIndices) {
    if (projectedLen <= cap) break;
    toDrop.add(idx);
    projectedLen -= 1;
  }

  if (toDrop.size === 0) {
    // No auto entries available to evict; manual pinning honored.
    return checkpoints;
  }

  return checkpoints.filter((_, idx) => !toDrop.has(idx));
}

/**
 * Revert to the checkpoint with the given `id`.
 *
 * On success, returns the truncated array `[0..K]` where K is the
 * index of the matched checkpoint (the chosen checkpoint itself is
 * preserved as the new tail) and the matched checkpoint as
 * `snapshot` so callers can restore `aiData` / `chatHistory` /
 * `loopCursor` from it (Req 4.5).
 *
 * On miss (no checkpoint matches `id`), returns the input array
 * unchanged and `snapshot: null`.  We deliberately do not throw —
 * the UI may race against a checkpoint eviction, and the caller can
 * surface a friendly "checkpoint no longer available" message
 * without wrapping every revert in a try/catch.
 *
 * The input array is not mutated: `slice` returns a fresh array.
 */
export function revertToCheckpoint(
  checkpoints: Checkpoint[],
  id: string,
): { newCheckpoints: Checkpoint[]; snapshot: Checkpoint | null } {
  const index = checkpoints.findIndex((cp) => cp.id === id);
  if (index === -1) {
    return { newCheckpoints: checkpoints, snapshot: null };
  }
  return {
    newCheckpoints: checkpoints.slice(0, index + 1),
    snapshot: checkpoints[index],
  };
}
