import { describe, it, expect } from 'vitest';
import {
  META_EXECUTORS,
  setTaskPlanExecutor,
  updateTaskStatusExecutor,
  requestUserClarificationExecutor,
  markTaskCompleteExecutor,
} from '@/lib/ai/tools/meta';
import { TOOL_REGISTRY } from '@/lib/ai/tools';

/**
 * Validates: Req 6.2 — the four meta executors return the documented
 * `ToolExecutorResult` shapes for valid args and `{ kind: 'noop' }`
 * with a descriptive reason for invalid args. None of them throw,
 * none of them mutate state directly.
 */

describe('setTaskPlanExecutor', () => {
  it('returns { kind: "plan" } with validated steps for valid args', () => {
    const result = setTaskPlanExecutor.execute(
      {
        steps: [
          { id: 'a', title: 'Step A' },
          { id: 'b', title: 'Step B', description: 'detail', status: 'active' },
        ],
      },
      undefined as never,
    );
    expect(result).toEqual({
      kind: 'plan',
      steps: [
        { id: 'a', title: 'Step A', description: undefined, status: 'pending' },
        { id: 'b', title: 'Step B', description: 'detail', status: 'active' },
      ],
    });
  });

  it('returns noop when steps is not an array', () => {
    const result = setTaskPlanExecutor.execute({ steps: 'oops' }, undefined as never);
    expect(result).toEqual({ kind: 'noop', reason: 'set_task_plan: steps must be an array' });
  });

  it('returns noop when a step is missing title', () => {
    const result = setTaskPlanExecutor.execute(
      { steps: [{ id: 'a' }] },
      undefined as never,
    );
    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') {
      expect(result.reason).toMatch(/steps\[0\]\.title/);
    }
  });

  it('returns noop on duplicate step ids', () => {
    const result = setTaskPlanExecutor.execute(
      { steps: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }] },
      undefined as never,
    );
    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') {
      expect(result.reason).toMatch(/duplicate step id/);
    }
  });
});

describe('updateTaskStatusExecutor', () => {
  it('returns { kind: "plan-status" } for valid args', () => {
    expect(
      updateTaskStatusExecutor.execute(
        { id: 'a', status: 'done' },
        undefined as never,
      ),
    ).toEqual({ kind: 'plan-status', id: 'a', status: 'done' });
  });

  it('returns noop on bad status', () => {
    const result = updateTaskStatusExecutor.execute(
      { id: 'a', status: 'finished' },
      undefined as never,
    );
    expect(result.kind).toBe('noop');
  });

  it('returns noop on empty id', () => {
    const result = updateTaskStatusExecutor.execute(
      { id: '', status: 'done' },
      undefined as never,
    );
    expect(result.kind).toBe('noop');
  });
});

describe('requestUserClarificationExecutor', () => {
  it('returns { kind: "clarify" } for a non-empty question', () => {
    expect(
      requestUserClarificationExecutor.execute(
        { question: 'Which dataset?' },
        undefined as never,
      ),
    ).toEqual({ kind: 'clarify', question: 'Which dataset?' });
  });

  it('returns noop on a whitespace-only question', () => {
    const result = requestUserClarificationExecutor.execute(
      { question: '   ' },
      undefined as never,
    );
    expect(result.kind).toBe('noop');
  });
});

describe('markTaskCompleteExecutor', () => {
  it('returns { kind: "complete" } with no summary when args omitted', () => {
    expect(
      markTaskCompleteExecutor.execute(undefined, undefined as never),
    ).toEqual({ kind: 'complete' });
  });

  it('returns { kind: "complete", summary } when supplied', () => {
    expect(
      markTaskCompleteExecutor.execute(
        { summary: 'All set.' },
        undefined as never,
      ),
    ).toEqual({ kind: 'complete', summary: 'All set.' });
  });

  it('returns noop when summary is the wrong type', () => {
    const result = markTaskCompleteExecutor.execute(
      { summary: 42 },
      undefined as never,
    );
    expect(result.kind).toBe('noop');
  });
});

describe('META_EXECUTORS registry integration', () => {
  it('exports an aggregator with all four meta executors', () => {
    expect(Object.keys(META_EXECUTORS).sort()).toEqual([
      'mark_task_complete',
      'request_user_clarification',
      'set_task_plan',
      'update_task_status',
    ]);
    expect(META_EXECUTORS.set_task_plan).toBe(setTaskPlanExecutor);
    expect(META_EXECUTORS.update_task_status).toBe(updateTaskStatusExecutor);
    expect(META_EXECUTORS.request_user_clarification).toBe(requestUserClarificationExecutor);
    expect(META_EXECUTORS.mark_task_complete).toBe(markTaskCompleteExecutor);
  });

  it('TOOL_REGISTRY.executors contains all four meta executors after module load', () => {
    expect(TOOL_REGISTRY.executors.set_task_plan).toBe(setTaskPlanExecutor);
    expect(TOOL_REGISTRY.executors.update_task_status).toBe(updateTaskStatusExecutor);
    expect(TOOL_REGISTRY.executors.request_user_clarification).toBe(requestUserClarificationExecutor);
    expect(TOOL_REGISTRY.executors.mark_task_complete).toBe(markTaskCompleteExecutor);
  });
});
