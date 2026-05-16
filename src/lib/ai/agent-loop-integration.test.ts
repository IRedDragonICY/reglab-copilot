import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Content, Part } from '@google/genai';
import type { AIReportData } from '@/lib/types';
import type { LoopCursor } from '@/lib/copilot/types';
import {
  runAgentLoop,
  type AgentLoopArgs,
  type AgentLoopCallbacks,
} from '@/lib/ai/agent-loop';

/**
 * Integration tests for `runAgentLoop`'s task 2.2 additions.
 *
 * Validates: Requirements 2.1, 2.2, 2.4 (quota retry — recover and
 * exhaust paths), 3.4, 3.5 (resume from cursor), 9.5 (additive,
 * legacy-safe behavior).
 *
 * Each test mocks the Gemini SDK via `vi.mock('@google/genai', ...)`
 * and drives `mockGenerateContentStream` to either reject (quota) or
 * yield a small async iterable.
 */

// ---------------------------------------------------------------------------
// SDK mock — hoisted so the factory can reference the mocks.
// ---------------------------------------------------------------------------

const mockGenerateContentStream = vi.hoisted(() => vi.fn());
const mockGoogleGenAI = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    models: {
      generateContentStream: mockGenerateContentStream,
    },
  })),
);

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    GoogleGenAI: mockGoogleGenAI,
  };
});

async function* asyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

const EMPTY_AI_DATA: AIReportData = {
  preTestAnswers: [],
  postTestAnswers: [],
  alatDanBahan: [],
  stepByStepNarrative: '',
  codeAnalysis: '',
  cellAnalyses: [],
  pendahuluan: '',
};

function chunk(parts: unknown[]): unknown {
  return { candidates: [{ content: { parts } }] };
}
function textChunk(text: string) {
  return chunk([{ text }]);
}
function toolCallChunk(name: string, args: unknown, id = 'fc-1') {
  return chunk([{ functionCall: { name, args, id } }]);
}

const QUOTA_429 = Object.assign(new Error('Too many requests'), { status: 429 });

function baseArgs(overrides: Partial<AgentLoopArgs> = {}): AgentLoopArgs {
  return {
    apiKey: 'test-key',
    modelId: 'gemini-test',
    contents: [{ role: 'user', parts: [{ text: 'kick off' } as Part] }],
    systemInstruction: 'sys',
    declaration: { name: 'generate_report' },
    maxLoops: 5,
    sysMsgBuilder: (loop) => `Continue batch ${loop}`,
    mode: 'append',
    initial: EMPTY_AI_DATA,
    callbacks: {},
    ...overrides,
  };
}

describe('runAgentLoop — quota retry integration', () => {
  beforeEach(() => {
    mockGenerateContentStream.mockReset();
    mockGoogleGenAI.mockReset();
    mockGoogleGenAI.mockImplementation(() => ({
      models: { generateContentStream: mockGenerateContentStream },
    }));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recovers from two transient 429s and completes the run successfully', async () => {
    // First two SDK calls reject with quota errors. The third resolves
    // with a stream that emits a tool call (so iteration 1 merges
    // successfully). The fourth SDK call (iteration 2) returns final
    // text only and the loop terminates.
    mockGenerateContentStream
      .mockRejectedValueOnce(QUOTA_429)
      .mockRejectedValueOnce(QUOTA_429)
      .mockResolvedValueOnce(
        asyncIterable([
          toolCallChunk(
            'generate_report',
            { praktikum: { langkah_kerja: 'all good now' } },
            'fc-1',
          ),
        ]),
      )
      .mockResolvedValueOnce(asyncIterable([textChunk('Final wrap-up.')]));

    const onRetryAttempt = vi.fn();
    const onMergeComplete = vi.fn();
    const onLoopCursorUpdate = vi.fn();

    const callbacks: AgentLoopCallbacks = {
      onRetryAttempt,
      onMergeComplete,
      onLoopCursorUpdate,
    };

    const promise = runAgentLoop(baseArgs({ callbacks }));

    // Iteration 1: attempt 1 immediate, sleep 1s before attempt 2,
    // sleep 2s before attempt 3 (which succeeds).
    // Iteration 2: attempt 1 immediate, no retries needed.
    await vi.advanceTimersByTimeAsync(1000 + 2000);
    const result = await promise;

    // Two retries fired in iteration 1 (announcing attempts 2 and 3
    // after each failure), zero in iteration 2.
    expect(onRetryAttempt).toHaveBeenCalledTimes(2);
    expect(onRetryAttempt).toHaveBeenNthCalledWith(1, 2, 1000);
    expect(onRetryAttempt).toHaveBeenNthCalledWith(2, 3, 2000);

    // The merge happened exactly once and accumulated the langkah_kerja.
    expect(onMergeComplete).toHaveBeenCalledTimes(1);
    expect(result.stepByStepNarrative).toContain('all good now');

    // Cursor was emitted at safe boundaries: top of iter 1 + post-merge
    // of iter 1 + top of iter 2 = 3 snapshots.
    expect(onLoopCursorUpdate).toHaveBeenCalledTimes(3);
  });

  it('exhausts retries on persistent 429s and emits a cursor before throwing', async () => {
    // Default schedule = 5 retries → 6 total attempts. All 6 reject
    // with 429s; withQuotaRetry surfaces the last error.
    for (let i = 0; i < 6; i++) {
      mockGenerateContentStream.mockRejectedValueOnce(QUOTA_429);
    }

    const onLoopCursorUpdate = vi.fn();
    const onMergeComplete = vi.fn();

    const promise = runAgentLoop(
      baseArgs({ callbacks: { onLoopCursorUpdate, onMergeComplete } }),
    );
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000);

    await expect(promise).rejects.toBe(QUOTA_429);

    // The top-of-iteration cursor was emitted exactly once (we never
    // got past the first iteration because retries exhausted).
    expect(onLoopCursorUpdate).toHaveBeenCalledTimes(1);
    const cursor = onLoopCursorUpdate.mock.calls[0][0] as LoopCursor;
    expect(cursor.iterationIndex).toBe(1);
    expect(cursor.lastSuccessfulMergeIndex).toBe(0);
    expect(cursor.maxLoops).toBe(5);

    // No merge ever fired.
    expect(onMergeComplete).not.toHaveBeenCalled();
  });
});

describe('runAgentLoop — auto-checkpoint requests', () => {
  beforeEach(() => {
    mockGenerateContentStream.mockReset();
    mockGoogleGenAI.mockReset();
    mockGoogleGenAI.mockImplementation(() => ({
      models: { generateContentStream: mockGenerateContentStream },
    }));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires exactly one onCheckpointRequest per authoritative merge', async () => {
    // Iteration 1: emits a generate_report tool call → authoritative
    // merge fires → onCheckpointRequest fires once.
    // Iteration 2: only text → no merge → no checkpoint request.
    mockGenerateContentStream
      .mockResolvedValueOnce(
        asyncIterable([
          toolCallChunk(
            'generate_report',
            { praktikum: { langkah_kerja: 'step' } },
            'fc-1',
          ),
        ]),
      )
      .mockResolvedValueOnce(asyncIterable([textChunk('done')]));

    const onCheckpointRequest = vi.fn();
    const onMergeComplete = vi.fn();

    const promise = runAgentLoop(
      baseArgs({ callbacks: { onCheckpointRequest, onMergeComplete } }),
    );
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(onMergeComplete).toHaveBeenCalledTimes(1);
    expect(onCheckpointRequest).toHaveBeenCalledTimes(1);
    // Snapshot includes the merged data and the iteration index.
    expect(onCheckpointRequest).toHaveBeenCalledWith({
      aiData: expect.objectContaining({
        stepByStepNarrative: expect.stringContaining('step'),
      }),
      loopIndex: 1,
    });
  });
});

describe('runAgentLoop — resume from cursor', () => {
  beforeEach(() => {
    mockGenerateContentStream.mockReset();
    mockGoogleGenAI.mockReset();
    mockGoogleGenAI.mockImplementation(() => ({
      models: { generateContentStream: mockGenerateContentStream },
    }));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the cursor iteration index and uses the cursor contents/state', async () => {
    // Cursor says "iteration 3 should run next; here is the state".
    const cursorContents: Content[] = [
      { role: 'user', parts: [{ text: 'original prompt' } as Part] },
      { role: 'model', parts: [{ text: 'iter 1 model turn' } as Part] },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'generate_report',
              id: 'fc-prev',
              response: { status: 'success', message: 'continue' },
            },
          } as Part,
        ],
      },
    ];

    const accumulatedFromPrior: AIReportData = {
      ...EMPTY_AI_DATA,
      stepByStepNarrative: 'Prior step from iter 1.',
      cellAnalyses: [
        {
          cellIndex: 0,
          section: 'implementasi',
          caption: 'prior cap',
          explanation: 'prior exp',
        },
      ],
    };

    const resumeCursor: LoopCursor = {
      contents: cursorContents,
      iterationIndex: 3,
      lastSuccessfulMergeIndex: 1,
      accumulatedAiData: accumulatedFromPrior,
      mode: 'append',
      declarationKey: 'praktikum',
      systemInstruction: 'sys-from-cursor',
      modelId: 'gemini-test',
      maxLoops: 5,
      enableGoogleSearch: false,
      enableCodeExecution: false,
      pendingTools: [],
    };

    // Iteration 3: emit a tool call that adds another step. We capture
    // the `contents` argument at call time because the loop mutates the
    // contents array in-place, so reading mock.calls[0][0].contents
    // after the loop completes would observe later iterations' appends.
    const callContentSnapshots: number[] = [];
    const callSystemInstructions: string[] = [];
    const callModels: string[] = [];
    mockGenerateContentStream.mockImplementation((arg: any) => {
      callContentSnapshots.push((arg.contents as unknown[]).length);
      callSystemInstructions.push(arg.config.systemInstruction);
      callModels.push(arg.model);
      return Promise.resolve(
        callContentSnapshots.length === 1
          ? asyncIterable([
              toolCallChunk(
                'generate_report',
                { praktikum: { langkah_kerja: 'iter 3 step' } },
                'fc-3',
              ),
            ])
          : asyncIterable([textChunk('done')]),
      );
    });

    const onIterationStart = vi.fn().mockReturnValue('msg-x');
    const onMergeComplete = vi.fn();

    // Note: the args.contents and args.initial below are intentionally
    // *different* from the cursor — the cursor MUST take precedence.
    const promise = runAgentLoop(
      baseArgs({
        contents: [
          { role: 'user', parts: [{ text: 'unused — cursor wins' } as Part] },
        ],
        systemInstruction: 'unused-sys',
        modelId: 'unused-model',
        maxLoops: 99,
        initial: EMPTY_AI_DATA,
        resumeCursor,
        callbacks: { onIterationStart, onMergeComplete },
      }),
    );

    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    // First iteration after resume runs at the cursor's iterationIndex.
    expect(onIterationStart).toHaveBeenCalledTimes(2);
    expect(onIterationStart).toHaveBeenNthCalledWith(1, 3);
    expect(onIterationStart).toHaveBeenNthCalledWith(2, 4);

    // The SDK was called with the cursor's modelId and systemInstruction,
    // not the args defaults. Snapshots are captured at call time
    // (see `mockImplementation` above) because the loop mutates
    // `contents` in-place across iterations.
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
    expect(callModels[0]).toBe('gemini-test');
    expect(callSystemInstructions[0]).toBe('sys-from-cursor');

    // The conversation sent to the SDK on the first iteration starts
    // from the cursor's contents (3 entries from cursor + nothing
    // else on the first call).
    expect(callContentSnapshots[0]).toBe(3);

    // The merge accumulates onto the prior state (append mode).
    expect(onMergeComplete).toHaveBeenCalledTimes(1);
    const mergedData = onMergeComplete.mock.calls[0][0] as AIReportData;
    expect(mergedData.stepByStepNarrative).toBe('Prior step from iter 1.\niter 3 step');
    expect(mergedData.cellAnalyses).toEqual(accumulatedFromPrior.cellAnalyses);

    // Final result reflects the merged accumulator.
    expect(result.stepByStepNarrative).toBe('Prior step from iter 1.\niter 3 step');
  });

  it('respects an aborted signal at the top of the iteration without calling the SDK', async () => {
    // Cursor with iter 1 pending — but we abort before the loop even
    // makes the SDK call. The loop should exit gracefully and return
    // the accumulated data.
    const controller = new AbortController();
    controller.abort('pause');

    const onIterationStart = vi.fn().mockReturnValue('m');
    const onLoopCursorUpdate = vi.fn();

    const result = await runAgentLoop(
      baseArgs({
        signal: controller.signal,
        callbacks: { onIterationStart, onLoopCursorUpdate },
      }),
    );

    // Loop exited immediately with the initial accumulator.
    expect(result).toEqual(EMPTY_AI_DATA);

    // The SDK was never invoked.
    expect(mockGenerateContentStream).not.toHaveBeenCalled();

    // A cursor was emitted at the top of iteration 1 before abort
    // detection, so the caller can persist + later resume.
    expect(onLoopCursorUpdate).toHaveBeenCalledTimes(1);
    const cursor = onLoopCursorUpdate.mock.calls[0][0] as LoopCursor;
    expect(cursor.iterationIndex).toBe(1);

    // onIterationStart was NOT called — the abort check sits above it
    // (after the cursor snapshot). The exact ordering between the
    // cursor snapshot and the abort check is the safe-boundary
    // contract: snapshot first so the cursor reflects the iteration
    // we are about to abort.
    expect(onIterationStart).not.toHaveBeenCalled();
  });
});
