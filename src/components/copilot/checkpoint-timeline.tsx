/**
 * Checkpoint timeline drawer (task 19.1).
 *
 * Vertical list of session checkpoints, newest first. Each row shows:
 *   - State dot: filled blue for `auto`, filled amber for `manual`
 *   - Time + label
 *   - 📌 marker on manual checkpoints (pinned, never auto-evicted)
 *   - View button (opens read-only diff against current `aiData`)
 *   - Revert button (only enabled once a row is selected — Req 4.4a)
 *
 * Selection state is local: the user clicks a row to select, then
 * Revert becomes enabled. Tooltip on the disabled Revert reads
 * `Select a checkpoint first`.
 *
 * This task ships the static markup. Wiring the drawer toggle and
 * the revert / view-diff handlers lands in 19.2.
 */

import { useState } from 'react';
import { Eye, History, Pin, Undo2, X } from 'lucide-react';
import type { Checkpoint } from '@/lib/copilot/types';
import { cn } from '@/lib/utils';

export interface CheckpointTimelineProps {
  checkpoints: Checkpoint[];
  onView?: (id: string) => void;
  onRevert?: (id: string) => void;
  onClose?: () => void;
}

function formatRelativeTime(ms: number): string {
  const date = new Date(ms);
  // Round-trip via locale string so timestamps match the manual save
  // labels (which also use `toLocaleString`).
  return date.toLocaleString();
}

export function CheckpointTimeline(props: CheckpointTimelineProps) {
  const { checkpoints, onView, onRevert, onClose } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Newest first — checkpoints are pushed in chronological order, so a
  // copy-and-reverse is enough; we don't need to re-sort by createdAt.
  const ordered = [...checkpoints].reverse();
  const revertEnabled = !!selectedId && !!onRevert;

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] border-l border-[#1F1F1F] w-[360px]">
      {/* Header */}
      <div className="shrink-0 h-9 flex items-center justify-between pl-3 pr-1 border-b border-[#1F1F1F] bg-[#0A0A0A] select-none">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-[#6E6E6E]" />
          <span className="text-[12px] font-medium text-[#EDEDED]">Checkpoints</span>
          <span className="text-[11px] text-[#6E6E6E] font-mono">
            {checkpoints.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={!onClose}
          className="w-7 h-7 inline-flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] disabled:opacity-50 rounded-sm"
          title="Close timeline"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-10 h-10 flex items-center justify-center border border-[#1F1F1F] mb-3 rounded-sm">
              <History className="w-4 h-4 text-[#4A4A4A]" />
            </div>
            <p className="text-[12px] text-[#EDEDED] font-medium">No checkpoints yet</p>
            <p className="text-[11px] text-[#6E6E6E] mt-1 max-w-[240px]">
              Run the agent or save one manually to start tracking changes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#1A1A1A]">
            {ordered.map((cp) => {
              const isSelected = selectedId === cp.id;
              const isManual = cp.source === 'manual';
              return (
                <li key={cp.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(cp.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(cp.id);
                      }
                    }}
                    className={cn(
                      'group cursor-pointer px-3 py-2 transition-colors outline-none',
                      isSelected
                        ? 'bg-[#0F1A2E] border-l-2 border-l-[#2F81F7]'
                        : 'hover:bg-[#0C0C0C] border-l-2 border-l-transparent',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0 mt-1.5',
                          isManual ? 'bg-[#D29922]' : 'bg-[#2F81F7]',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] text-[#EDEDED] font-medium truncate">
                            {cp.label}
                          </span>
                          {isManual && (
                            <Pin
                              className="w-3 h-3 text-[#D29922] shrink-0"
                              aria-label="Pinned (manual)"
                            />
                          )}
                        </div>
                        <div className="text-[10px] text-[#6E6E6E] font-mono mt-0.5">
                          {formatRelativeTime(cp.createdAt)}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1 shrink-0 transition-opacity',
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                        )}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onView?.(cp.id);
                          }}
                          disabled={!onView}
                          className="h-6 px-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#A1A1A1] hover:text-white hover:bg-[#161616] disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                          title="View diff"
                        >
                          <Eye className="w-3 h-3" />
                          <span className="sr-only">View</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer — Revert action (Req 4.4a). */}
      <div className="shrink-0 h-11 flex items-center justify-between px-3 border-t border-[#1F1F1F] bg-[#070707]">
        <span className="text-[11px] text-[#6E6E6E]">
          {selectedId ? 'Selected. Revert resets to this state.' : 'Click a checkpoint to enable revert.'}
        </span>
        <button
          type="button"
          onClick={() => selectedId && onRevert?.(selectedId)}
          disabled={!revertEnabled}
          title={revertEnabled ? 'Revert to selected checkpoint' : 'Select a checkpoint first'}
          className="h-7 px-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#2F81F7] hover:bg-[#2563EB] disabled:bg-[#161616] disabled:text-[#4A4A4A] disabled:cursor-not-allowed transition-colors rounded-sm"
        >
          <Undo2 className="w-3 h-3" />
          <span>Revert</span>
        </button>
      </div>
    </div>
  );
}

export default CheckpointTimeline;
