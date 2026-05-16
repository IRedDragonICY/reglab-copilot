import { describe, it, expect } from 'vitest';
import {
  createCheckpoint,
  evictIfOverCap,
  revertToCheckpoint,
  DEFAULT_CHECKPOINT_CAP,
} from '@/lib/copilot/checkpoint-store';
import type { Checkpoint } from '@/lib/copilot/types';
import type { AIReportData } from '@/lib/types';

/**
 * Validates: Requirements 4.1 (immutable checkpoints), 4.3 (50-cap
 * eviction with manual pinning), and 4.5 (revert preserves [0..K],
 * discards [K+1..N]) for the pure checkpoint-store helpers.
 */

const EMPTY_AI_DATA: AIReportData = {
  preTestAnswers: [],
  postTestAnswers: [],
  stepByStepNarrative: '',
  codeAnalysis: '',
};

/**
 * Construct a minimal valid `Checkpoint` for `evict` and `revert`
 * tests.  We bypass `createCheckpoint` so we can pin `id`,
 * `createdAt`, and `source` deterministically without coupling to
 * the random UUID / wall-clock minting inside the factory.
 */
function makeCheckpoint(
  source: 'auto' | 'manual',
  createdAt: number,
  label: string,
): Checkpoint {
  return {
    id: `${source}-${createdAt}`,
    createdAt,
    label,
    source,
    aiDataSnapshot: EMPTY_AI_DATA,
    chatHistorySnapshot: [],
    loopCursorSnapshot: null,
  };
}

const makeAuto = (createdAt: number, label = 'auto') =>
  makeCheckpoint('auto', createdAt, label);

const makeManual = (createdAt: number, label = 'manual') =>
  makeCheckpoint('manual', createdAt, label);

describe('createCheckpoint', () => {
  it('mints a uuid id, fresh createdAt, and a frozen object', () => {
    const before = Date.now();
    const cp = createCheckpoint({
      source: 'manual',
      label: 'test',
      aiData: EMPTY_AI_DATA,
      chatHistory: [],
      loopCursor: null,
    });
    const after = Date.now();

    // RFC-4122 v4 UUID: 8-4-4-4-12 hex chars separated by hyphens.
    expect(cp.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(cp.id).toHaveLength(36);
    expect(cp.createdAt).toBeGreaterThanOrEqual(before);
    expect(cp.createdAt).toBeLessThanOrEqual(after);
    expect(Object.isFrozen(cp)).toBe(true);
    expect(cp.source).toBe('manual');
    expect(cp.label).toBe('test');
  });

  it('stores the supplied snapshots by reference (callers handle cloning)', () => {
    const aiData: AIReportData = { ...EMPTY_AI_DATA, pendahuluan: 'intro' };
    const cp = createCheckpoint({
      source: 'auto',
      label: 'a',
      aiData,
      chatHistory: [],
      loopCursor: null,
    });
    expect(cp.aiDataSnapshot).toBe(aiData);
  });
});

describe('evictIfOverCap', () => {
  it('returns the input untouched (referentially equal) when length <= cap', () => {
    const list: Checkpoint[] = Array.from({ length: 50 }, (_, i) =>
      makeAuto(i),
    );
    const result = evictIfOverCap(list);
    expect(result).toBe(list);
    expect(result).toHaveLength(50);
  });

  it('evicts the oldest auto checkpoint when the cap (default 50) is exceeded by one', () => {
    // 51 auto checkpoints with strictly ascending createdAt.
    const list: Checkpoint[] = Array.from({ length: 51 }, (_, i) =>
      makeAuto(i, `auto-${i}`),
    );

    const result = evictIfOverCap(list);

    expect(result).toHaveLength(50);
    // Original input not mutated.
    expect(list).toHaveLength(51);
    // Oldest (createdAt = 0) is gone; createdAt = 1..50 survive.
    expect(result.find((c) => c.createdAt === 0)).toBeUndefined();
    expect(result.map((c) => c.createdAt)).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 1),
    );
  });

  it('never evicts manual checkpoints, even when the cap is exceeded (Req 4.3)', () => {
    const list: Checkpoint[] = Array.from({ length: 51 }, (_, i) =>
      makeManual(i),
    );
    const result = evictIfOverCap(list);
    // Cap is intentionally exceeded — all 51 manual entries pinned.
    expect(result).toHaveLength(51);
  });

  it('on a mixed array, evicts only the oldest auto entries down to cap and pins all manual', () => {
    // 30 auto with createdAt 0..29, 25 manual with createdAt 100..124.
    // Total length 55, cap 50 ⇒ 5 auto evicted (the 5 oldest).
    const autos = Array.from({ length: 30 }, (_, i) => makeAuto(i, `a-${i}`));
    const manuals = Array.from({ length: 25 }, (_, i) =>
      makeManual(100 + i, `m-${i}`),
    );
    const list = [...autos, ...manuals];

    const result = evictIfOverCap(list);

    expect(result).toHaveLength(50);
    // All 25 manuals are still there.
    expect(result.filter((c) => c.source === 'manual')).toHaveLength(25);
    // 25 autos remain (30 - 5 evicted).
    const remainingAutos = result.filter((c) => c.source === 'auto');
    expect(remainingAutos).toHaveLength(25);
    // The 5 oldest autos (createdAt 0..4) were dropped.
    expect(remainingAutos.map((c) => c.createdAt).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 5),
    );
  });

  it('returns the input untouched when no auto entries remain to evict', () => {
    // 60 manual checkpoints, cap 50: nothing evictable, length stays 60.
    const list: Checkpoint[] = Array.from({ length: 60 }, (_, i) =>
      makeManual(i),
    );
    const result = evictIfOverCap(list);
    expect(result).toHaveLength(60);
    // Implementation may short-circuit; assert all entries are pinned.
    expect(result.every((c) => c.source === 'manual')).toBe(true);
  });

  it('exposes DEFAULT_CHECKPOINT_CAP === 50 to match Req 4.3', () => {
    expect(DEFAULT_CHECKPOINT_CAP).toBe(50);
  });
});

describe('revertToCheckpoint', () => {
  it('truncates [K+1..N] and preserves [0..K] including the chosen checkpoint (Req 4.5)', () => {
    const list: Checkpoint[] = Array.from({ length: 10 }, (_, i) =>
      makeAuto(i, `auto-${i}`),
    );
    const target = list[5];

    const { newCheckpoints, snapshot } = revertToCheckpoint(list, target.id);

    expect(newCheckpoints).toHaveLength(6);
    expect(snapshot?.id).toBe(target.id);
    // 0..5 preserved in order.
    expect(newCheckpoints.map((c) => c.id)).toEqual(
      list.slice(0, 6).map((c) => c.id),
    );
    // 6..9 discarded.
    for (const dropped of list.slice(6)) {
      expect(newCheckpoints.find((c) => c.id === dropped.id)).toBeUndefined();
    }
  });

  it('returns the input array and a null snapshot when the id is missing', () => {
    const list: Checkpoint[] = [makeAuto(0), makeManual(1)];
    const result = revertToCheckpoint(list, 'no-such-id');
    expect(result.newCheckpoints).toBe(list);
    expect(result.snapshot).toBeNull();
  });

  it('does not mutate the input array', () => {
    const list: Checkpoint[] = Array.from({ length: 5 }, (_, i) => makeAuto(i));
    const snapshot = list.slice();

    revertToCheckpoint(list, list[2].id);

    expect(list).toEqual(snapshot);
    expect(list).toHaveLength(5);
  });
});
