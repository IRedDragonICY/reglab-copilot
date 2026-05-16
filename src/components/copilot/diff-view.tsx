/**
 * Diff view modal (task 18.1).
 *
 * Cursor-style review surface for a `PendingMerge`. Renders two
 * top-level controls (side-by-side ↔ unified toggle, close) plus
 * collapsible field sections. In **pending** mode (auto-accept OFF)
 * each hunk shows Accept / Reject buttons; in **read-only** mode
 * (auto-accept ON, opened from a checkpoint) the buttons are absent
 * and the diff is purely informational (Req 5.4 / 5.7).
 *
 * This task ships the static markup. Wiring the modal into
 * `pendingMerge` and the accept/reject hooks is task 18.2.
 *
 * Hunks are pre-grouped by `field`. For `cellAnalyses` we further
 * split per entry keyed by `entryKey` (Req 5.3) so the user can
 * accept "this new cell" without also accepting unrelated cell
 * modifications.
 */

import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Columns,
  FileText,
  Rows,
  X,
} from 'lucide-react';
import type { PendingMerge, Hunk, LineChange, QAPairDiff } from '@/lib/copilot/types';
import { cn } from '@/lib/utils';

export interface DiffViewProps {
  /** Required snapshot to render. The modal is mounted by the parent only when set. */
  pending: PendingMerge;
  /**
   * `pending` shows Accept / Reject buttons per hunk; `readonly`
   * hides them and is used when previewing a checkpoint with
   * auto-accept ON.
   */
  mode?: 'pending' | 'readonly';
  onAccept?: (hunkId: string) => void;
  onReject?: (hunkId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onClose?: () => void;
}

type DiffMode = 'unified' | 'side-by-side';

const FIELD_LABEL: Record<Hunk['field'], string> = {
  pendahuluan: 'pendahuluan',
  stepByStepNarrative: 'stepByStepNarrative',
  codeAnalysis: 'codeAnalysis',
  alatDanBahan: 'alatDanBahan',
  preTestAnswers: 'preTestAnswers',
  postTestAnswers: 'postTestAnswers',
  cellAnalyses: 'cellAnalyses',
};

/** Group hunks by field for the section list. Order matches FIELD_LABEL. */
function groupByField(hunks: Hunk[]): { field: Hunk['field']; hunks: Hunk[] }[] {
  const buckets = new Map<Hunk['field'], Hunk[]>();
  for (const h of hunks) {
    const list = buckets.get(h.field) ?? [];
    list.push(h);
    buckets.set(h.field, list);
  }
  return (Object.keys(FIELD_LABEL) as (keyof typeof FIELD_LABEL)[])
    .filter((f) => buckets.has(f))
    .map((f) => ({ field: f, hunks: buckets.get(f)! }));
}

/** Compact summary line for a field section header. */
function summarizeField(hunks: Hunk[]): string {
  if (hunks[0]?.field === 'cellAnalyses') {
    const counts = { add: 0, remove: 0, modify: 0 };
    for (const h of hunks) {
      if (h.field === 'cellAnalyses') counts[h.kind]++;
    }
    const parts: string[] = [];
    if (counts.add) parts.push(`${counts.add} added`);
    if (counts.modify) parts.push(`${counts.modify} modified`);
    if (counts.remove) parts.push(`${counts.remove} removed`);
    return parts.join(', ') || 'no changes';
  }
  // For string/array fields the section has exactly one hunk.
  const h = hunks[0];
  if ('lineDiff' in h && h.lineDiff) {
    const added = h.lineDiff.filter((c) => c.added).length;
    const removed = h.lineDiff.filter((c) => c.removed).length;
    return `${added} added, ${removed} removed`;
  }
  if ('pairDiffs' in h && h.pairDiffs) {
    const c = h.pairDiffs.reduce(
      (acc, d) => {
        if (d.kind === 'add') acc.add++;
        else if (d.kind === 'remove') acc.remove++;
        else if (d.kind === 'modify') acc.modify++;
        return acc;
      },
      { add: 0, modify: 0, remove: 0 },
    );
    const parts: string[] = [];
    if (c.add) parts.push(`${c.add} added`);
    if (c.modify) parts.push(`${c.modify} modified`);
    if (c.remove) parts.push(`${c.remove} removed`);
    return parts.join(', ') || 'no changes';
  }
  return 'changed';
}

/** Renders a per-line diff in unified or side-by-side layout. */
function LineDiffBlock({
  before,
  after,
  changes,
  diffMode,
}: {
  before: string;
  after: string;
  changes: LineChange[];
  diffMode: DiffMode;
}) {
  if (diffMode === 'unified') {
    return (
      <pre className="font-mono text-[11px] leading-[1.55] bg-[#050505] rounded-sm overflow-x-auto">
        {changes.map((c, i) => (
          <div
            key={i}
            className={cn(
              'px-3 py-0.5 whitespace-pre-wrap',
              c.added && 'bg-[#0E2618] text-[#56D364]',
              c.removed && 'bg-[#2A1010] text-[#F85149]',
              !c.added && !c.removed && 'text-[#A1A1A1]',
            )}
          >
            <span className="select-none mr-2 text-[#6E6E6E]">
              {c.added ? '+' : c.removed ? '-' : ' '}
            </span>
            {c.value || '\n'}
          </div>
        ))}
      </pre>
    );
  }

  // Side-by-side: render before and after as two columns. Lossy for
  // multi-line edits but readable for the common short-string case.
  return (
    <div className="grid grid-cols-2 gap-px bg-[#1F1F1F] rounded-sm overflow-hidden">
      <pre className="font-mono text-[11px] leading-[1.55] bg-[#050505] p-3 whitespace-pre-wrap text-[#A1A1A1] overflow-x-auto">
        {before || <span className="text-[#4A4A4A]">(empty)</span>}
      </pre>
      <pre className="font-mono text-[11px] leading-[1.55] bg-[#050505] p-3 whitespace-pre-wrap text-[#EDEDED] overflow-x-auto">
        {after || <span className="text-[#4A4A4A]">(empty)</span>}
      </pre>
    </div>
  );
}

/** QA pair diff body for preTestAnswers / postTestAnswers. */
function QaDiffBlock({ pairDiffs }: { pairDiffs: QAPairDiff[] }) {
  return (
    <div className="flex flex-col gap-1 bg-[#050505] rounded-sm overflow-hidden">
      {pairDiffs.map((d) => (
        <div
          key={d.index}
          className={cn(
            'px-3 py-2 text-[11px] leading-[1.55] border-b border-[#1F1F1F] last:border-0',
            d.kind === 'add' && 'bg-[#0E2618] text-[#56D364]',
            d.kind === 'remove' && 'bg-[#2A1010] text-[#F85149]',
            d.kind === 'modify' && 'bg-[#1A1208] text-[#D29922]',
            d.kind === 'unchanged' && 'text-[#6E6E6E]',
          )}
        >
          <div className="font-mono text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
            #{d.index} · {d.kind}
          </div>
          {d.before && (
            <div className="opacity-80">
              <span className="font-medium">Q:</span> {d.before.q}
            </div>
          )}
          {d.after && (
            <div>
              <span className="font-medium">Q:</span> {d.after.q}
              <br />
              <span className="font-medium">A:</span> {d.after.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Single-hunk renderer dispatched on `field` and (for cellAnalyses) `kind`. */
function HunkBody({ hunk, diffMode }: { hunk: Hunk; diffMode: DiffMode }) {
  if (
    hunk.field === 'pendahuluan' ||
    hunk.field === 'stepByStepNarrative' ||
    hunk.field === 'codeAnalysis'
  ) {
    return (
      <LineDiffBlock
        before={hunk.before}
        after={hunk.after}
        changes={hunk.lineDiff}
        diffMode={diffMode}
      />
    );
  }
  if (hunk.field === 'alatDanBahan') {
    return (
      <LineDiffBlock
        before={hunk.before.join('\n')}
        after={hunk.after.join('\n')}
        changes={hunk.lineDiff}
        diffMode={diffMode}
      />
    );
  }
  if (hunk.field === 'preTestAnswers' || hunk.field === 'postTestAnswers') {
    return <QaDiffBlock pairDiffs={hunk.pairDiffs} />;
  }
  // cellAnalyses
  if (hunk.field !== 'cellAnalyses') return null; // unreachable, narrows the union
  return (
    <div className="bg-[#050505] rounded-sm p-3 text-[11px] leading-[1.55] flex flex-col gap-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-[#6E6E6E]">
        {hunk.kind} · {hunk.entryKey}
      </div>
      {hunk.before && (
        <div className="border border-[#2A1010] bg-[#1A0808] rounded-sm p-2">
          <div className="font-mono text-[10px] text-[#F85149] mb-1">before</div>
          <div className="text-[#A1A1A1] whitespace-pre-wrap break-words">
            <strong className="text-[#EDEDED]">{hunk.before.caption}</strong>
            {' — '}
            {hunk.before.explanation}
          </div>
        </div>
      )}
      {hunk.after && (
        <div className="border border-[#0E2618] bg-[#08130D] rounded-sm p-2">
          <div className="font-mono text-[10px] text-[#56D364] mb-1">after</div>
          <div className="text-[#EDEDED] whitespace-pre-wrap break-words">
            <strong>{hunk.after.caption}</strong>
            {' — '}
            {hunk.after.explanation}
          </div>
        </div>
      )}
    </div>
  );
}

/** Top-level <DiffView /> modal. */
export function DiffView(props: DiffViewProps) {
  const {
    pending,
    mode = 'pending',
    onAccept,
    onReject,
    onAcceptAll,
    onRejectAll,
    onClose,
  } = props;
  const [diffMode, setDiffMode] = useState<DiffMode>('unified');
  const [collapsed, setCollapsed] = useState<Set<Hunk['field']>>(new Set());
  const grouped = useMemo(() => groupByField(pending.hunks), [pending.hunks]);
  const isPending = mode === 'pending';

  const toggleField = (field: Hunk['field']) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
      <div
        className="bg-[#0A0A0A] w-[920px] max-w-[calc(100vw-32px)] h-[680px] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden border border-[#2A2A2A] rounded-md"
        role="dialog"
        aria-modal="true"
      >
        {/* Title bar */}
        <div className="shrink-0 h-10 flex items-center justify-between pl-3 pr-1 border-b border-[#1F1F1F] bg-[#0A0A0A] select-none">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#6E6E6E]" />
            <span className="text-[12px] font-medium text-[#EDEDED]">
              {isPending ? 'Review pending changes' : 'Diff'}
            </span>
            <span className="text-[11px] text-[#6E6E6E] font-mono">
              · iteration {pending.iterationIndex}
            </span>
            <span className="text-[11px] text-[#6E6E6E] font-mono">
              · {pending.hunks.length} {pending.hunks.length === 1 ? 'hunk' : 'hunks'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center border border-[#1F1F1F] rounded-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setDiffMode('unified')}
                className={cn(
                  'h-7 px-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide transition-colors',
                  diffMode === 'unified'
                    ? 'bg-[#161616] text-white'
                    : 'text-[#A1A1A1] hover:text-white hover:bg-[#161616]',
                )}
                title="Unified"
              >
                <Rows className="w-3 h-3" />
                <span>Unified</span>
              </button>
              <button
                type="button"
                onClick={() => setDiffMode('side-by-side')}
                className={cn(
                  'h-7 px-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide transition-colors',
                  diffMode === 'side-by-side'
                    ? 'bg-[#161616] text-white'
                    : 'text-[#A1A1A1] hover:text-white hover:bg-[#161616]',
                )}
                title="Side-by-side"
              >
                <Columns className="w-3 h-3" />
                <span>Split</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={!onClose}
              className="w-8 h-8 inline-flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] disabled:opacity-50 rounded-sm"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
          {grouped.length === 0 && (
            <div className="text-[12px] text-[#6E6E6E] py-8 text-center">
              No changes to review.
            </div>
          )}
          {grouped.map(({ field, hunks }) => {
            const isCollapsed = collapsed.has(field);
            return (
              <section
                key={field}
                className="border border-[#1F1F1F] rounded-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleField(field)}
                  className="w-full h-9 px-3 flex items-center gap-2 bg-[#0C0C0C] hover:bg-[#111111] transition-colors text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-[#6E6E6E]" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-[#6E6E6E]" />
                  )}
                  <span className="font-mono text-[11px] text-[#2F81F7]">
                    {FIELD_LABEL[field]}
                  </span>
                  <span className="text-[11px] text-[#6E6E6E]">
                    {summarizeField(hunks)}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-2 p-3 bg-[#0A0A0A]">
                    {hunks.map((hunk) => (
                      <div
                        key={hunk.id}
                        className="border border-[#1F1F1F] rounded-sm overflow-hidden"
                      >
                        <div className="px-3 py-1.5 bg-[#0C0C0C] flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[#6E6E6E] truncate">
                            {hunk.id}
                          </span>
                          {isPending && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onAccept?.(hunk.id)}
                                disabled={!onAccept}
                                className="h-6 px-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#56D364] hover:bg-[#08130D] disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                              >
                                <Check className="w-3 h-3" />
                                <span>Accept</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onReject?.(hunk.id)}
                                disabled={!onReject}
                                className="h-6 px-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#F85149] hover:bg-[#1A0808] disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <HunkBody hunk={hunk} diffMode={diffMode} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Footer */}
        {isPending && (
          <div className="shrink-0 h-11 flex items-center justify-between px-3 border-t border-[#1F1F1F] bg-[#070707]">
            <span className="text-[11px] text-[#6E6E6E]">
              {pending.hunks.length} pending {pending.hunks.length === 1 ? 'hunk' : 'hunks'}.
              Accept or reject to resume the agent.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRejectAll}
                disabled={!onRejectAll}
                className="h-7 px-3 inline-flex items-center gap-1.5 text-[11px] text-[#F85149] hover:bg-[#1A0808] border border-[#3A1414] disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
              >
                <X className="w-3 h-3" />
                <span>Reject all</span>
              </button>
              <button
                type="button"
                onClick={onAcceptAll}
                disabled={!onAcceptAll}
                className="h-7 px-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#2EA043] hover:bg-[#268B3A] disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
              >
                <Check className="w-3 h-3" />
                <span>Accept all</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiffView;
