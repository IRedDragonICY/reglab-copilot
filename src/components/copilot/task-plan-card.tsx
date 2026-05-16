/**
 * Task Plan card — Req 10.5 / 10.7 / 10.9.
 *
 * A collapsible checklist that lives BETWEEN the chat thread and the
 * composer (chat-anchored, where the user's eyes are after sending a
 * message). Replaces the always-expanded "Task plan" section that
 * used to live inside the always-on-top <ActiveTaskPanel />.
 *
 * Behavior:
 *  - Collapsed default: when every step is `done` (auto-tucks out of
 *    the way after a successful run).
 *  - Expanded default: when any step is `active` OR the run hasn't
 *    started any step yet (`pending` only).
 *  - Auto-fade: 4000ms after every step is `done` AND `runState`
 *    has settled to `'idle'`, the card fades out (CSS `opacity 200ms`)
 *    so the chat reclaims the space. The plan stays in session
 *    history; only the render is hidden.
 *  - Click-to-scroll: clicking a step row attempts to scroll the
 *    chat thread to the latest agent message that mentions the
 *    step's `id` or `title` substring.
 *
 * Pure presentational. No store reads. Owns local `expanded` state.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  ListChecks,
} from 'lucide-react';
import type { TaskPlan, RunState } from '@/lib/copilot/types';
import { cn } from '@/lib/utils';

const AUTO_FADE_MS = 4000;

export interface TaskPlanCardProps {
  taskPlan: TaskPlan | null;
  runState: RunState;
  /** Click-to-scroll handler: gets the matched message id or null. */
  onJumpToStep?: (stepId: string, stepTitle: string) => void;
}

function deriveDefaultExpanded(plan: TaskPlan | null): boolean {
  return false;
}

export function TaskPlanCard({
  taskPlan,
  runState,
  onJumpToStep,
}: TaskPlanCardProps) {
  const [expanded, setExpanded] = useState<boolean>(() =>
    deriveDefaultExpanded(taskPlan),
  );
  const [faded, setFaded] = useState(false);
  const lastPlanIdRef = useRef<string | null>(null);

  // When the plan reference flips (new run or first plan), recompute
  // the default expansion. Local clicks during a run are preserved.
  useEffect(() => {
    if (!taskPlan) {
      lastPlanIdRef.current = null;
      setFaded(false);
      return;
    }
    const sig = taskPlan.steps.map((s) => s.id).join('|');
    if (sig !== lastPlanIdRef.current) {
      lastPlanIdRef.current = sig;
      setExpanded(deriveDefaultExpanded(taskPlan));
      setFaded(false);
    }
  }, [taskPlan]);

  // Auto-fade once every step is done AND the run has settled.
  useEffect(() => {
    if (!taskPlan) return;
    const allDone = taskPlan.steps.every((s) => s.status === 'done');
    if (allDone && runState === 'idle') {
      const t = setTimeout(() => setFaded(true), AUTO_FADE_MS);
      return () => clearTimeout(t);
    }
    setFaded(false);
    return undefined;
  }, [taskPlan, runState]);

  // Req 10.10: zero layout height when no plan.
  if (!taskPlan || taskPlan.steps.length === 0) return null;
  if (faded) return null;

  const total = taskPlan.steps.length;
  const done = taskPlan.steps.filter((s) => s.status === 'done').length;
  const activeStep = taskPlan.steps.find((s) => s.status === 'active');
  const isComplete = done === total;

  return (
    <div
      className={cn(
        'shrink-0 border-t border-[#1F1F1F] bg-[#0A0A0A] text-[#EDEDED] transition-opacity duration-200',
        faded ? 'opacity-0' : 'opacity-100',
      )}
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full h-8 flex items-center gap-2 px-3 hover:bg-[#0F0F0F] transition-colors outline-none text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-[#6E6E6E] shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#6E6E6E] shrink-0" />
        )}
        <ListChecks className="w-3 h-3 text-[#A1A1A1] shrink-0" />
        <span className="text-[11px] font-medium text-[#EDEDED]">Task plan</span>
        <span
          className={cn(
            'text-[11px] font-mono',
            isComplete ? 'text-[#2EA043]' : 'text-[#6E6E6E]',
          )}
        >
          {done}/{total}
        </span>
        {!expanded && activeStep && (
          <span className="flex-1 min-w-0 flex items-center gap-1.5 truncate ml-1">
            <Loader2 className="w-3 h-3 text-[#2F81F7] animate-spin shrink-0" />
            <span className="text-[11px] text-[#A1A1A1] truncate">
              {activeStep.title}
            </span>
          </span>
        )}
        {!expanded && !activeStep && isComplete && (
          <span className="flex-1 text-[11px] text-[#2EA043] truncate ml-1">
            All steps complete
          </span>
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <ul className="flex flex-col gap-0.5 px-3 pb-2 pt-0.5">
          {taskPlan.steps.map((step) => (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-2 px-1.5 py-1 rounded-sm cursor-pointer transition-colors',
                'hover:bg-[#111111]',
              )}
              onClick={() => onJumpToStep?.(step.id, step.title)}
              title="Jump to related agent message"
            >
              {step.status === 'done' ? (
                <Check className="w-3 h-3 text-[#2EA043] shrink-0" />
              ) : step.status === 'active' ? (
                <Loader2 className="w-3 h-3 text-[#2F81F7] animate-spin shrink-0" />
              ) : (
                <Circle className="w-3 h-3 text-[#4A4A4A] shrink-0" />
              )}
              <span
                className={cn(
                  'text-[11px] truncate flex-1',
                  step.status === 'done'
                    ? 'text-[#A1A1A1] line-through decoration-[#2A2A2A]'
                    : step.status === 'active'
                      ? 'text-[#EDEDED]'
                      : 'text-[#A1A1A1]',
                )}
              >
                {step.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TaskPlanCard;
