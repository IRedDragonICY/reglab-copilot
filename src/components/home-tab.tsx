'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { format } from 'date-fns';
import {
  Clock, FileText, Plus, Trash2, CheckCircle2, Circle, List,
  BarChart3, Hash, ChevronRight
} from 'lucide-react';
import { ScheduleManager } from '@/components/schedule-manager';
import { toast } from 'sonner';

/* ---------------------------------------------------------------------------
   Flat panel primitives — no shadows, crisp 1px borders.
--------------------------------------------------------------------------- */

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`flex flex-col bg-[#0F0F0F] border border-[#1F1F1F] min-h-0 ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  icon,
  title,
  meta,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="shrink-0 h-9 flex items-center justify-between px-3 border-b border-[#1F1F1F] bg-[#0A0A0A]">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-[#6E6E6E]">{icon}</div>
        <h2 className="text-[12px] font-semibold text-[#EDEDED]">
          {title}
        </h2>
        {meta && (
          <span className="text-[11px] text-[#6E6E6E] pl-2 border-l border-[#1F1F1F] ml-1">
            {meta}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}

/* --------------------------------------------------------------------------- */

export function HomeTab() {
  // Sliced subscriptions — re-render only when these specific arrays
  // change reference. The previous `useAppStore()` no-selector call
  // re-rendered HomeTab on every store mutation (including unrelated
  // toggleCopilot / setActiveTab calls), which combined with the
  // O(n log n) sort below caused noticeable jank during boot.
  const sessions = useAppStore((s) => s.sessions);
  const schedules = useAppStore((s) => s.schedules);
  const mataPraktikumList = useAppStore((s) => s.mataPraktikumList);
  const manualProgress = useAppStore((s) => s.manualProgress);
  const createNewSession = useAppStore((s) => s.createNewSession);
  const deleteAllSessions = useAppStore((s) => s.deleteAllSessions);
  const toggleManualProgress = useAppStore((s) => s.toggleManualProgress);
  const openSessionTab = useAppStore((s) => s.openSessionTab);
  const deleteSession = useAppStore((s) => s.deleteSession);

  const handleCreateRef = () => {
    createNewSession();
  };

  // Memoize the sort: O(n log n) only when `sessions` reference flips.
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  // Memoize the grouping pipeline. Recomputes only when one of the
  // four source slices changes reference.
  const { groupedPraktikum, praktikumSubjects } = useMemo(() => {
    const grouped: Record<
      string,
      { pertemuan: number; type: 'auto' | 'manual'; date?: string }[]
    > = {};
    const allSubjects = new Set<string>();

    (mataPraktikumList || []).forEach((subject) => {
      if (subject) allSubjects.add(subject);
    });

    (schedules || []).forEach((schedule) => {
      if (schedule.mataPraktikum) allSubjects.add(schedule.mataPraktikum);
    });

    allSubjects.forEach((subject) => {
      grouped[subject] = [];
    });

    sessions.forEach((session) => {
      const { reportType, mataPraktikum, pertemuan, hariTanggalSesi } = session.metadata;
      if ((reportType === 'praktikum' || !reportType) && mataPraktikum && mataPraktikum.trim() !== '') {
        if (!grouped[mataPraktikum]) grouped[mataPraktikum] = [];
        if (pertemuan) {
          const existing = grouped[mataPraktikum].find((p) => p.pertemuan === pertemuan);
          const dateStr = hariTanggalSesi || format(new Date(session.updatedAt), 'dd MMM yyyy, HH:mm');
          if (!existing) {
            grouped[mataPraktikum].push({ pertemuan, type: 'auto', date: dateStr });
          }
        }
      }
    });

    const mp = manualProgress || {};
    Object.keys(mp).forEach((subject) => {
      if (!grouped[subject]) grouped[subject] = [];
      mp[subject].forEach((pertemuanNum) => {
        const existing = grouped[subject].find((p) => p.pertemuan === pertemuanNum);
        if (!existing) {
          grouped[subject].push({ pertemuan: pertemuanNum, type: 'manual' });
        }
      });
    });

    return { groupedPraktikum: grouped, praktikumSubjects: Object.keys(grouped) };
  }, [sessions, schedules, mataPraktikumList, manualProgress]);


  return (
    <div className="h-full flex flex-col gap-2 w-full font-sans text-[#EDEDED]">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* ==================================================
            LEFT COLUMN (span 8): Schedule + Progress
        ================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-2 min-h-0">
          {/* Schedule */}
          <div className="shrink-0 flex flex-col max-h-[50%] min-h-[220px]">
            <ScheduleManager />
          </div>

          {/* Progress Tracker */}
          {praktikumSubjects.length > 0 && (
            <Panel className="flex-1">
              <PanelHeader
                icon={<BarChart3 className="w-3.5 h-3.5" />}
                title="Progress Tracker"
                meta={`${praktikumSubjects.length} subjects`}
              />
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 xl:grid-cols-2">
                  {praktikumSubjects.map((subject, idx) => {
                    const completed = groupedPraktikum[subject];
                    const totalCompleted = completed.length;
                    const pct = Math.round((totalCompleted / 10) * 100);
                    return (
                      <div
                        key={subject}
                        className={`p-3 border-[#1A1A1A] ${idx % 2 === 1 ? 'xl:border-l' : ''} border-b`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3
                            className="font-medium text-[12px] text-[#EDEDED] truncate pr-2"
                            title={subject}
                          >
                            {subject}
                          </h3>
                          <span className="font-mono text-[10px] text-[#A1A1A1] whitespace-nowrap">
                            {totalCompleted}/10
                          </span>
                        </div>

                        {/* Progress bar — flat, bordered */}
                        <div className="h-[3px] w-full bg-[#161616] mb-2 relative">
                          <div
                            className="absolute top-0 left-0 h-full bg-[#2F81F7] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {/* Cell grid */}
                        <div className="flex border border-[#1F1F1F] bg-[#0A0A0A]">
                          {[...Array(10)].map((_, i) => {
                            const pertemuanNum = i + 1;
                            const doneData = completed.find((c) => c.pertemuan === pertemuanNum);
                            const isDone = !!doneData;
                            const isManual = doneData?.type === 'manual';

                            let tooltip = `Pertemuan ${pertemuanNum} — Not started`;
                            if (isDone) {
                              tooltip = `Pertemuan ${pertemuanNum} — ${
                                isManual ? 'Manually checked' : `Completed: ${doneData.date}`
                              }`;
                            }

                            return (
                              <button
                                key={pertemuanNum}
                                onClick={() => toggleManualProgress(subject, pertemuanNum)}
                                title={tooltip}
                                className={`group relative flex-1 h-8 flex flex-col items-center justify-center transition-colors border-r last:border-r-0 border-[#1F1F1F] ${
                                  isDone
                                    ? isManual
                                      ? 'bg-[#0F1A2E] hover:bg-[#142442]'
                                      : 'bg-[#0F1F15] hover:bg-[#132B1C]'
                                    : 'hover:bg-[#161616]'
                                }`}
                              >
                                <span
                                  className={`font-mono text-[9px] leading-none ${
                                    isDone
                                      ? isManual
                                        ? 'text-[#2F81F7]'
                                        : 'text-[#2EA043]'
                                      : 'text-[#4A4A4A] group-hover:text-[#6E6E6E]'
                                  }`}
                                >
                                  {String(pertemuanNum).padStart(2, '0')}
                                </span>
                                {isDone ? (
                                  <CheckCircle2
                                    className={`w-2.5 h-2.5 mt-0.5 ${
                                      isManual ? 'text-[#2F81F7]' : 'text-[#2EA043]'
                                    }`}
                                  />
                                ) : (
                                  <Circle className="w-2.5 h-2.5 mt-0.5 text-[#2A2A2A] group-hover:text-[#4A4A4A]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="shrink-0 h-7 flex items-center justify-end gap-4 px-3 border-t border-[#1F1F1F] bg-[#0A0A0A] font-mono text-[10px] text-[#6E6E6E]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#2EA043]" /> auto
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#2F81F7]" /> manual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 border border-[#2A2A2A]" /> pending
                </span>
              </div>
            </Panel>
          )}
        </div>

        {/* ==================================================
            RIGHT COLUMN (span 4): Document History
        ================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 min-h-0">
          <Panel className="h-full">
            <PanelHeader
              icon={<List className="w-3.5 h-3.5" />}
              title="Document History"
              meta={`${sortedSessions.length} ${sortedSessions.length === 1 ? 'doc' : 'docs'}`}
              actions={
                <>
                  <button
                    onClick={handleCreateRef}
                    className="h-6 px-2 flex items-center gap-1 text-[10px] font-medium text-[#EDEDED] bg-[#2F81F7] hover:bg-[#2563EB] transition-colors rounded-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span className="tracking-wide uppercase">New</span>
                  </button>
                  {sortedSessions.length > 0 && (
                    <button
                      onClick={() => {
                        deleteAllSessions();
                        toast.success('All history cleared');
                      }}
                      className="h-6 px-2 text-[10px] text-[#A1A1A1] hover:text-[#F85149] hover:bg-[#1C1C1C] transition-colors rounded-sm"
                    >
                      Clear all
                    </button>
                  )}
                </>
              }
            />

            <div className="flex-1 overflow-y-auto">
              {sortedSessions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-10 h-10 flex items-center justify-center border border-[#1F1F1F] mb-4 rounded-sm">
                    <FileText className="w-4 h-4 text-[#4A4A4A]" />
                  </div>
                  <p className="text-[12px] text-[#EDEDED] font-medium">No reports yet</p>
                  <p className="text-[11px] text-[#6E6E6E] mt-1">
                    Click <span className="text-[#EDEDED]">New</span> to start your first report.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#1A1A1A]">
                  {sortedSessions.map((session) => (
                    <li
                      key={session.id}
                      onClick={() => openSessionTab(session)}
                      className="group relative flex items-start gap-3 px-3 py-2.5 hover:bg-[#111111] cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#2F81F7] shrink-0 mt-0.5" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[12px] text-[#EDEDED] truncate font-medium">
                            {session.title}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                              toast.success('Session deleted');
                            }}
                            className="shrink-0 w-5 h-5 flex items-center justify-center text-[#6E6E6E] hover:text-[#F85149] hover:bg-[#1C1C1C] opacity-0 group-hover:opacity-100 transition-all rounded-sm"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="mt-1 flex items-center gap-3 text-[11px] text-[#6E6E6E]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {format(session.updatedAt, 'dd MMM yy, HH:mm')}
                          </span>
                          {session.metadata.pertemuan && (
                            <span className="flex items-center gap-1">
                              <Hash className="w-2.5 h-2.5" />
                              Session {session.metadata.pertemuan}
                            </span>
                          )}
                        </div>

                        {(session.metadata.mataPraktikum || session.metadata.judulPertemuan) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#A1A1A1]">
                            {session.metadata.mataPraktikum && (
                              <span className="truncate">{session.metadata.mataPraktikum}</span>
                            )}
                            {session.metadata.mataPraktikum && session.metadata.judulPertemuan && (
                              <span className="text-[#2A2A2A]">·</span>
                            )}
                            {session.metadata.judulPertemuan && (
                              <span className="truncate text-[#6E6E6E]">
                                {session.metadata.judulPertemuan}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <ChevronRight className="w-3.5 h-3.5 text-[#2A2A2A] group-hover:text-[#6E6E6E] shrink-0 mt-0.5 transition-colors" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
