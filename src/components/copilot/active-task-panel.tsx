/**
 * Active task panel — task 5.1 (shell only).
 *
 * Always-visible status strip rendered above the chat thread inside the
 * Copilot panel (Req 7). This task ships the static markup, visibility
 * state machine, and stubbed action buttons. Wiring of `runState`,
 * iteration counter, retry status, etc. lands in task 5.2.
 *
 * Conventions:
 *  - Pure presentational. No `useAppStore`, no `useCopilotAI`.
 *  - All inputs flow through props.
 *  - Buttons disable themselves when their handler prop is undefined,
 *    so this task ships every button disabled while task 5.2 enables
 *    them simply by supplying handlers.
 */

import { useEffect, useState } from 'react';
import {
  BookmarkPlus,
  CheckCircle2,
  History,
  Loader2,
  Pause,
  Play,
} from 'lucide-react';

import type {
  RunState,
  TaskPlan,
  ToolCallState,
} from '@/lib/copilot/types';

/**
 * Color tokens by `RunState`. Falls back to gray for `idle` so the
 * map is total. The dot colors mirror design.md "Active Task Panel".
 */
const STATE_COLORS: Record<RunState, string> = {
  idle: '#6E6E6E',
  running: '#2F81F7',
  paused: '#D29922',
  error: '#F85149',
  stopped: '#6E6E6E',
};

const STOPPED_AUTO_HIDE_MS = 3000;

export interface ActiveTaskPanelProps {
  runState: RunState;
  /** 1-based iteration index. `0` means no run has started yet. */
  iteration: number;
  maxLoops: number;
  currentTool?: ToolCallState | null;
  retryStatus?: { attempt: number; total: number; delayMs: number } | null;
  /** Free-form sub-status, e.g. "Analyzing image 4 of 12" (Req 7.7). */
  subStatus?: string | null;
  taskPlan?: TaskPlan | null;
  onPause?: () => void;
  onContinue?: () => void;
  onStop?: () => void;
  onSaveCheckpoint?: () => void;
  onOpenCheckpoints?: () => void;
}

const BUTTON_CLASS =
  'h-6 px-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide ' +
  'text-[#A1A1A1] hover:text-white hover:bg-[#161616] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-sm';

export function ActiveTaskPanel(props: ActiveTaskPanelProps) {
  const {
    runState,
    iteration,
    maxLoops,
    currentTool,
    retryStatus,
    subStatus,
    onPause,
    onContinue,
    onStop,
    onSaveCheckpoint,
    onOpenCheckpoints,
  } = props;
  // `taskPlan` is part of the props contract but the checklist is
  // now rendered by <TaskPlanCard /> next to the composer. Keep the
  // prop optional in the type so callers don't have to change.
  void onStop;

  // Visibility for the `stopped` auto-hide (Req 7.2). Initialized true
  // and reset whenever `runState` flips back to a non-stopped value.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (runState === 'stopped') {
      const t = setTimeout(() => setVisible(false), STOPPED_AUTO_HIDE_MS);
      return () => clearTimeout(t);
    }
    // Any non-stopped state means we should be visible again.
    setVisible(true);
    return undefined;
  }, [runState]);

  if (runState === 'idle') return null;
  if (runState === 'stopped' && !visible) return null;

  const dotColor = STATE_COLORS[runState];
  const showIteration = iteration > 0;

  return (
    <div className="border-t border-b border-[#1F1F1F] bg-[#0C0C0C] text-[#EDEDED]">
      {/* Top status row */}
      <div className="flex items-center gap-3 px-3 py-2">
        <span
          aria-hidden
          className={`w-1.5 h-1.5 rounded-full shrink-0${
            runState === 'running' ? ' animate-pulse' : ''
          }`}
          style={{ backgroundColor: dotColor }}
        />
        <span className="font-mono text-[11px] text-[#A1A1A1] lowercase">
          {runState}
        </span>

        {showIteration && (
          <span className="font-mono text-[11px] text-[#A1A1A1]">
            Iteration {iteration} of {maxLoops}
          </span>
        )}

        {currentTool && (
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[11px] text-[#2F81F7] truncate">
              {currentTool.name}
            </span>
            {currentTool.status === 'running' ? (
              <Loader2 className="w-3 h-3 text-[#2F81F7] animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-[#2EA043] shrink-0" />
            )}
          </span>
        )}

        {/* Action buttons (right-aligned). Visibility per design:
            running → Pause + Stop + Save + Open
            paused  → Continue + Stop + Save + Open
            error   → Continue + Stop + Open
            stopped → no buttons
            Each button is auto-disabled when no handler is supplied so
            task 5.1 ships them all disabled and task 5.2 enables them
            by passing real callbacks. */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {runState === 'running' && (
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={!onPause}
              onClick={() => onPause?.()}
              title="Pause"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          )}

          {(runState === 'paused' || runState === 'error') && (
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={!onContinue}
              onClick={() => onContinue?.()}
              title="Continue"
            >
              <Play className="w-3 h-3" />
              <span>Continue</span>
            </button>
          )}

          {(runState === 'running' || runState === 'paused') && (
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={!onSaveCheckpoint}
              onClick={() => onSaveCheckpoint?.()}
              title="Save checkpoint"
            >
              <BookmarkPlus className="w-3 h-3" />
              <span className="sr-only">Save checkpoint</span>
            </button>
          )}

          {runState !== 'stopped' && (
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={!onOpenCheckpoints}
              onClick={() => onOpenCheckpoints?.()}
              title="Open checkpoints"
            >
              <History className="w-3 h-3" />
              <span className="sr-only">Open checkpoints</span>
            </button>
          )}
        </div>
      </div>

      {/* Retry status row (Req 2.2). Only visible while still running —
          a stale retry message lingering after pause/stop/error/idle is
          confusing because the loop isn't actually waiting on a sleep
          anymore. */}
      {retryStatus && runState === 'running' && (
        <div className="border-t border-[#1F1F1F] px-3 py-1.5 text-[11px] text-[#D29922] font-mono">
          Quota throttled — retrying in {Math.ceil(retryStatus.delayMs / 1000)}s
          {' '}(attempt {retryStatus.attempt} of {retryStatus.total})
        </div>
      )}

      {/* Sub-status row (Req 7.7). */}
      {subStatus && (
        <div className="border-t border-[#1F1F1F] px-3 py-1.5 text-[11px] text-[#A1A1A1]">
          {subStatus}
        </div>
      )}

      {/* Task plan moved out of this panel and into <TaskPlanCard />,
          which mounts between the chat thread and the composer (Req
          10.7). The panel still accepts `taskPlan` as a prop for
          backwards compat with callers, but no longer renders it. */}
    </div>
  );
}

export default ActiveTaskPanel;
