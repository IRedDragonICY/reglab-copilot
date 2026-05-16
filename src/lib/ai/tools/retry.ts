/**
 * Quota retry helper for the Gemini SDK.
 *
 * Implements the retry budget mandated by Requirement 2.1 of the
 * `copilot-agent-upgrade` spec: up to 5 attempts at delays of
 * 1s/2s/4s/8s/16s before the caller surfaces an `error` Run_State.
 *
 * Contract notes (see design.md "Quota Retry"):
 * - Attempt 1 runs **immediately** with no sleep. Sleeps only happen
 *   *between* attempts — after a quota failure, before the next try.
 *   That matches what users (and the UI's "attempt K of 5" string)
 *   expect from a retry helper. The legacy "sleep before every attempt
 *   including the first" reading caused a phantom 1-second delay and
 *   a misleading "Quota throttled" status on every fresh request, even
 *   when no failure had occurred.
 * - `onAttempt(k, delayMs)` fires only when a retry is *actually* about
 *   to happen — i.e. after a quota failure, with the upcoming sleep.
 *   The first attempt does not call `onAttempt` (there's no retry to
 *   announce yet). This keeps the Active Task Panel's "Quota throttled"
 *   row tied to a real throttle event.
 * - Non-quota errors propagate immediately on the first throw.
 * - `signal` aborts during sleep — the returned promise rejects with
 *   `signal.reason` so the caller (e.g. `runAgentLoop` Pause/Stop wiring)
 *   can discriminate user cancellation from quota exhaustion.
 */

const DEFAULT_SCHEDULE: readonly number[] = [1000, 2000, 4000, 8000, 16000];

/**
 * Detects whether `err` looks like a Gemini quota error.
 *
 * Inspects (in order):
 * 1. `(err as any).status === 429`
 * 2. `(err as any).response?.status === 429`
 * 3. `(err as Error).message` matches `RESOURCE_EXHAUSTED` (case-insensitive)
 */
export function isQuotaError(err: unknown): boolean {
  if (err === null || err === undefined) return false;
  const anyErr = err as { status?: unknown; response?: { status?: unknown }; message?: unknown };
  if (anyErr.status === 429) return true;
  if (anyErr.response && anyErr.response.status === 429) return true;
  const message = anyErr.message;
  if (typeof message === 'string' && /resource_exhausted/i.test(message)) return true;
  return false;
}

export interface WithQuotaRetryOptions {
  /**
   * Fired immediately before each sleep with the attempt number (1-based)
   * and the upcoming delay in milliseconds. Use this to surface the retry
   * countdown in the Active Task Panel.
   */
  onAttempt?: (attempt: number, delayMs: number) => void;
  /**
   * Aborts the in-flight sleep (and rejects the returned promise) with
   * `signal.reason`.
   */
  signal?: AbortSignal;
  /**
   * Override the default `[1000, 2000, 4000, 8000, 16000]` schedule. The
   * length determines the maximum number of attempts.
   */
  schedule?: readonly number[];
}

/**
 * Sleep for `ms` milliseconds, rejecting with `signal.reason` if the signal
 * aborts. Resolves immediately for non-positive `ms`. Throws synchronously
 * via promise rejection if `signal` is already aborted on entry.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  }
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Executes `fn` with quota-aware retries.
 *
 * Flow:
 * 1. Run `fn()` immediately. If it succeeds, return.
 * 2. If it throws a non-quota error, rethrow immediately.
 * 3. If it throws a quota error and we still have budget, fire
 *    `onAttempt(nextAttempt, delayMs)`, sleep, then loop.
 * 4. After the schedule is exhausted, rethrow the last error.
 *
 * The `schedule[i]` entry is the delay BEFORE attempt `i + 2` (i.e.
 * `schedule[0]` is the wait before the second attempt, after the first
 * failed). The total maximum invocations of `fn` is therefore
 * `schedule.length + 1`.
 */
export async function withQuotaRetry<T>(
  fn: () => Promise<T>,
  opts: WithQuotaRetryOptions = {},
): Promise<T> {
  const schedule = opts.schedule ?? DEFAULT_SCHEDULE;
  const maxRetries = schedule.length;

  // Attempt 1 — immediate, no sleep, no `onAttempt`. There's nothing
  // to retry yet so announcing a retry would be misleading (and was
  // the source of the spurious "Quota throttled" status the UI showed
  // on every fresh request).
  if (opts.signal?.aborted) {
    throw opts.signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
  try {
    return await fn();
  } catch (err) {
    if (!isQuotaError(err)) throw err;
    if (maxRetries === 0) throw err;
    // Fall through to the retry loop with the first sleep.
    let lastError = err;
    for (let retry = 1; retry <= maxRetries; retry++) {
      const delayMs = schedule[retry - 1];
      // `onAttempt` reports the upcoming attempt number (1-based,
      // counting the first attempt as #1). retry=1 → attempt #2.
      opts.onAttempt?.(retry + 1, delayMs);
      await sleep(delayMs, opts.signal);
      try {
        return await fn();
      } catch (nextErr) {
        lastError = nextErr;
        if (!isQuotaError(nextErr)) throw nextErr;
        // Loop continues unless this was the final retry.
      }
    }
    throw lastError;
  }
}
