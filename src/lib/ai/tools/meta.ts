/**
 * Meta-tool executors (task 10.1).
 *
 * The four meta tools steer the agent loop's lifecycle without
 * mutating `AIReportData` directly:
 *
 *   - `set_task_plan(steps)`         → seed `session.taskPlan.steps`
 *   - `update_task_status(id, sts)`  → flip one step's status
 *   - `request_user_clarification(q)` → atomically pause and ask user
 *   - `mark_task_complete(summary?)` → terminate the run
 *
 * Each executor performs strict shape validation and returns a
 * `{ kind: 'noop', reason }` on invalid input — never throws — so a
 * malformed call is reported back to Gemini via the iteration's
 * `functionResponse` payload and the agent self-corrects on the next
 * turn (per design.md "Tool Executor Errors").
 *
 * The aggregator `META_EXECUTORS` is registered into
 * `TOOL_REGISTRY.executors` from `tools/index.ts` at module load, in
 * the same one-directional pattern the granular wave introduced.
 */

import type { TaskPlanStep, TaskStatus } from '@/lib/copilot/types';
import type { ToolExecutor, ToolExecutorResult } from './index';

function isObjectLike(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

const VALID_STATUSES: readonly TaskStatus[] = ['pending', 'active', 'done'];
function isTaskStatus(x: unknown): x is TaskStatus {
  return typeof x === 'string' && (VALID_STATUSES as readonly string[]).includes(x);
}

/**
 * Validates one declared step. `id` and `title` are required strings;
 * `description` is an optional string. Status is force-defaulted to
 * `'pending'` so the agent doesn't have to declare it on the initial
 * plan — `update_task_status` flips it later.
 */
function validatePlanStep(raw: unknown, i: number): TaskPlanStep | { error: string } {
  if (!isObjectLike(raw)) return { error: `set_task_plan: steps[${i}] must be an object` };
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    return { error: `set_task_plan: steps[${i}].id must be a non-empty string` };
  }
  if (typeof raw.title !== 'string' || raw.title.length === 0) {
    return { error: `set_task_plan: steps[${i}].title must be a non-empty string` };
  }
  if (raw.description !== undefined && typeof raw.description !== 'string') {
    return { error: `set_task_plan: steps[${i}].description must be a string when present` };
  }
  // Status defaults to 'pending' on initial declaration — Req 6.2 and
  // the panel's checklist UI both expect every step to carry a status.
  const status: TaskStatus = isTaskStatus(raw.status) ? raw.status : 'pending';
  return {
    id: raw.id,
    title: raw.title,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status,
  };
}

/** `set_task_plan(steps: { id, title, description? }[])` */
export const setTaskPlanExecutor: ToolExecutor = {
  name: 'set_task_plan',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || !Array.isArray(rawArgs.steps)) {
      return { kind: 'noop', reason: 'set_task_plan: steps must be an array' };
    }
    const validated: TaskPlanStep[] = [];
    for (let i = 0; i < rawArgs.steps.length; i++) {
      const result = validatePlanStep(rawArgs.steps[i], i);
      if ('error' in result) {
        return { kind: 'noop', reason: result.error };
      }
      validated.push(result);
    }
    // Reject duplicate ids — `update_task_status` keys on id, so a
    // collision would silently update only the first match.
    const seen = new Set<string>();
    for (const step of validated) {
      if (seen.has(step.id)) {
        return { kind: 'noop', reason: `set_task_plan: duplicate step id "${step.id}"` };
      }
      seen.add(step.id);
    }
    return { kind: 'plan', steps: validated };
  },
};

/** `update_task_status(id: string, status: 'pending' | 'active' | 'done')` */
export const updateTaskStatusExecutor: ToolExecutor = {
  name: 'update_task_status',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs)) {
      return { kind: 'noop', reason: 'update_task_status: args must be an object' };
    }
    if (typeof rawArgs.id !== 'string' || rawArgs.id.length === 0) {
      return { kind: 'noop', reason: 'update_task_status: id must be a non-empty string' };
    }
    if (!isTaskStatus(rawArgs.status)) {
      return { kind: 'noop', reason: "update_task_status: status must be 'pending' | 'active' | 'done'" };
    }
    return { kind: 'plan-status', id: rawArgs.id, status: rawArgs.status };
  },
};

/** `request_user_clarification(question: string)` */
export const requestUserClarificationExecutor: ToolExecutor = {
  name: 'request_user_clarification',
  execute: (rawArgs): ToolExecutorResult => {
    if (!isObjectLike(rawArgs) || typeof rawArgs.question !== 'string' || rawArgs.question.trim().length === 0) {
      return { kind: 'noop', reason: 'request_user_clarification: question must be a non-empty string' };
    }
    return { kind: 'clarify', question: rawArgs.question };
  },
};

/** `mark_task_complete(summary?: string)` — terminator. */
export const markTaskCompleteExecutor: ToolExecutor = {
  name: 'mark_task_complete',
  execute: (rawArgs): ToolExecutorResult => {
    if (rawArgs === undefined || rawArgs === null) {
      return { kind: 'complete' };
    }
    if (!isObjectLike(rawArgs)) {
      return { kind: 'noop', reason: 'mark_task_complete: args must be an object or omitted' };
    }
    if (rawArgs.summary !== undefined && typeof rawArgs.summary !== 'string') {
      return { kind: 'noop', reason: 'mark_task_complete: summary must be a string when present' };
    }
    return {
      kind: 'complete',
      summary: typeof rawArgs.summary === 'string' ? rawArgs.summary : undefined,
    };
  },
};

/**
 * Aggregator consumed by `tools/index.ts` on module load. Same
 * registration pattern as `GRANULAR_EXECUTORS`.
 */
export const META_EXECUTORS: Record<string, ToolExecutor> = {
  set_task_plan: setTaskPlanExecutor,
  update_task_status: updateTaskStatusExecutor,
  request_user_clarification: requestUserClarificationExecutor,
  mark_task_complete: markTaskCompleteExecutor,
};
