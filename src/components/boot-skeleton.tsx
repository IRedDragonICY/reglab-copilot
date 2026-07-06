/**
 * Boot skeleton (Req 11).
 *
 * Mounted while `useAppStore.hasHydrated === false`. The visual
 * silhouette mirrors the post-hydration <HomeTab /> layout (two
 * panels — Practicum schedule + Document History — with a faint
 * progress bar at the bottom) so the transition into the live tree
 * feels like a fade rather than a layout jump.
 *
 * Constraints (Req 11.4):
 *  - No store reads, no async data, no API key requirements.
 *  - Pure presentational — safe to render inline before React mounts
 *    (the `index.html` <style> block embeds an HTML/CSS twin so the
 *    user sees the silhouette even before this component evaluates).
 *  - Under 80 LOC of TSX so the React mount stays lightweight.
 */

import { FileText, Calendar } from 'lucide-react';

interface BootSkeletonProps {
  /** When `true` the skeleton fades to opacity-0 — used for the 150ms
   *  cross-fade as <AppMain /> mounts (AC 11.5). */
  fadingOut?: boolean;
}

export function BootSkeleton({ fadingOut = false }: BootSkeletonProps) {
  return (
    <div
      className={`flex flex-col h-screen w-full bg-[#0A0A0A] text-[#EDEDED] overflow-hidden transition-opacity duration-150 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      aria-busy="true"
      aria-label="Loading Reglab Copilot"
    >
      {/* Top bars (mimic header strip) */}
      <div className="shrink-0 h-9 border-b border-[#1A1A1A] bg-[#0A0A0A]" />
      <div className="shrink-0 h-9 border-b border-[#1F1F1F] bg-[#0A0A0A]" />

      {/* Two-panel home silhouette */}
      <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 overflow-hidden">
        <SkeletonPanel
          title="Practicum schedule"
          icon={<Calendar className="w-3.5 h-3.5 text-[#4A4A4A]" />}
        />
        <SkeletonPanel
          title="Document History"
          icon={<FileText className="w-3.5 h-3.5 text-[#4A4A4A]" />}
        />
      </main>

      {/* Footer + indeterminate progress bar */}
      <footer className="shrink-0 h-6 flex items-center justify-between px-3 bg-[#0A0A0A] border-t border-[#1F1F1F] text-[11px] text-[#6E6E6E]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-[#2F81F7] rounded-full animate-pulse" />
          <span className="text-[#A1A1A1]">Loading workspace…</span>
        </span>
        <span>Reglab Copilot</span>
      </footer>

      {/* 1px indeterminate bar above the footer */}
      <div className="absolute left-0 right-0 bottom-6 h-[2px] bg-[#0F0F0F] overflow-hidden">
        <div className="h-full w-1/3 bg-[#2F81F7] animate-[bootslide_1200ms_ease-in-out_infinite] motion-reduce:animate-none" />
      </div>
      <style>{`
        @keyframes bootslide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

function SkeletonPanel({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <section className="bg-[#0C0C0C] border border-[#1F1F1F] rounded-sm flex flex-col overflow-hidden">
      <header className="h-9 flex items-center gap-2 px-3 border-b border-[#1F1F1F]">
        {icon}
        <span className="text-[12px] font-medium text-[#A1A1A1]">{title}</span>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-2">
        <div className="w-14 h-14 border border-[#1F1F1F] bg-[#111111] mb-5 rounded-full flex items-center justify-center">
          {icon}
        </div>
        <div className="h-4 w-40 bg-[#161616] rounded-sm animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-56 bg-[#101010] mt-2 mb-6 rounded-sm animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-32 bg-[#1C1C1C] rounded-sm animate-pulse motion-reduce:animate-none" />
      </div>
    </section>
  );
}

export default BootSkeleton;
