import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isQuotaError, withQuotaRetry } from '@/lib/ai/tools/retry';

/**
 * Validates: Requirements 2.1, 2.2 (quota retry budget + `onAttempt`
 * callback contract) and 2.4 (exhaustion rethrows the last error).
 *
 * Contract reminder (rewritten in this revision to match user expectations):
 *   - Attempt 1 is immediate. No pre-sleep, no `onAttempt`.
 *   - Sleeps and `onAttempt` fire only between attempts, after a
 *     quota failure, before the next try.
 *   - `schedule[i]` is the delay before attempt `i + 2`; the total
 *     maximum invocations of `fn` is `schedule.length + 1`.
 */

const QUOTA_429 = Object.assign(new Error('Too many requests'), { status: 429 });
const QUOTA_NESTED = Object.assign(new Error('limit'), { response: { status: 429 } });
const QUOTA_MESSAGE = new Error('429 RESOURCE_EXHAUSTED: quota');
const NON_QUOTA = Object.assign(new Error('boom'), { status: 500 });

describe('isQuotaError', () => {
  it('returns true for direct status=429', () => {
    expect(isQuotaError(QUOTA_429)).toBe(true);
  });

  it('returns true for response.status=429', () => {
    expect(isQuotaError(QUOTA_NESTED)).toBe(true);
  });

  it('returns true for messages containing RESOURCE_EXHAUSTED (case-insensitive)', () => {
    expect(isQuotaError(QUOTA_MESSAGE)).toBe(true);
    expect(isQuotaError(new Error('resource_exhausted: please slow down'))).toBe(true);
  });

  it('returns false for non-quota errors', () => {
    expect(isQuotaError(NON_QUOTA)).toBe(false);
    expect(isQuotaError(new Error('parse error'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
    expect(isQuotaError({})).toBe(false);
  });
});

describe('withQuotaRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs fn immediately on success — no sleep, no onAttempt call', async () => {
    const fn = vi.fn(async () => 'ok');
    const onAttempt = vi.fn();

    await expect(withQuotaRetry(fn, { onAttempt })).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('after one quota error, fires onAttempt(2, 1000), sleeps 1s, then succeeds', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(QUOTA_429)
      .mockResolvedValueOnce('ok');
    const onAttempt = vi.fn();
    const promise = withQuotaRetry(fn, { onAttempt });

    // First fn call rejects synchronously enough that we just need to
    // advance through the 1s sleep before attempt 2.
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 2, 1000);
  });

  it('succeeds on attempt 3 after two quota errors — onAttempt called twice with the schedule', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(QUOTA_429)
      .mockRejectedValueOnce(QUOTA_MESSAGE)
      .mockResolvedValueOnce('ok');
    const onAttempt = vi.fn();
    const promise = withQuotaRetry(fn, { onAttempt });

    // 1s sleep before attempt 2, then 2s sleep before attempt 3.
    await vi.advanceTimersByTimeAsync(1000 + 2000);
    await expect(promise).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(3);
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 2, 1000);
    expect(onAttempt).toHaveBeenNthCalledWith(2, 3, 2000);
  });

  it('throws the last quota error after exhausting all retries', async () => {
    // Default schedule = 5 retries → 6 total attempts.
    const lastErr = Object.assign(new Error('final 429'), { status: 429 });
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(QUOTA_429)
      .mockRejectedValueOnce(QUOTA_NESTED)
      .mockRejectedValueOnce(QUOTA_MESSAGE)
      .mockRejectedValueOnce(QUOTA_429)
      .mockRejectedValueOnce(QUOTA_429)
      .mockRejectedValueOnce(lastErr);
    const onAttempt = vi.fn();

    const promise = withQuotaRetry(fn, { onAttempt });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000);

    await expect(promise).rejects.toBe(lastErr);
    expect(fn).toHaveBeenCalledTimes(6);
    expect(onAttempt).toHaveBeenCalledTimes(5);
    expect(onAttempt).toHaveBeenNthCalledWith(5, 6, 16000);
  });

  it('propagates a non-quota error immediately without retrying', async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(NON_QUOTA);
    const onAttempt = vi.fn();

    await expect(withQuotaRetry(fn, { onAttempt })).rejects.toBe(NON_QUOTA);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('aborts during a retry sleep with the signal reason', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(QUOTA_429)
      .mockResolvedValueOnce('ok');
    const controller = new AbortController();
    const reason = new Error('user paused');

    const promise = withQuotaRetry(fn, { signal: controller.signal });
    promise.catch(() => {});

    // Let the first attempt fail and enter the 1s sleep, then abort
    // halfway through.
    await vi.advanceTimersByTimeAsync(500);
    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
    // First fn call ran; second never started.
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rejects synchronously if the signal is already aborted on entry', async () => {
    const fn = vi.fn<() => Promise<string>>().mockResolvedValue('ok');
    const controller = new AbortController();
    const reason = new Error('already gone');
    controller.abort(reason);

    await expect(withQuotaRetry(fn, { signal: controller.signal })).rejects.toBe(reason);
    expect(fn).not.toHaveBeenCalled();
  });

  it('honors a custom schedule for both retry count and delays', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(QUOTA_429)
      .mockResolvedValueOnce('ok');
    const onAttempt = vi.fn();
    const schedule = [50, 100];

    const promise = withQuotaRetry(fn, { onAttempt, schedule });
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toBe('ok');

    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 2, 50);
  });

  it('with an empty schedule, runs fn once and rethrows on quota error', async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(QUOTA_429);
    await expect(withQuotaRetry(fn, { schedule: [] })).rejects.toBe(QUOTA_429);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
