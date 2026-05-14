import { useEffect, useRef } from 'react';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type {
  AIReportData,
  PracticumSchedule,
  ReportMetadata,
  UserImage,
} from '@/lib/types';
import type { ParsedNotebook } from '@/lib/parser';

const DEFAULT_FILENAME = '{nim}_{nama}_{pertemuan}_{matkul}';

interface ReportDownloadCtx {
  metadata: ReportMetadata;
  aiPreviewData: AIReportData | null;
  generatedDocxBlob: Blob | null;
  setGeneratedDocxBlob: (b: Blob | null) => void;
  parsedNotebooks: ParsedNotebook[];
  postTestParsedNotebooks: ParsedNotebook[];
  preTestImages: UserImage[];
  implImages: UserImage[];
  postTestImages: UserImage[];
  modulContext: string;
  postTest: string;
}

/**
 * Resolve a filename template using the metadata fields. Public so the
 * test suite (and any future preview UI) can call it without simulating
 * the full download path.
 */
export function resolveFileName(
  format: string,
  metadata: ReportMetadata,
): string {
  let name = format
    .replace(/\{nim\}/g, metadata.nim || 'NIM')
    .replace(/\{nama\}/g, metadata.nama || 'Nama')
    .replace(/\{matkul\}/g, metadata.mataPraktikum || 'Praktikum')
    .replace(/\{pertemuan\}/g, metadata.pertemuan?.toString() || '0')
    .replace(/\{dosen\}/g, metadata.dosen || 'Dosen')
    .replace(/\{laboratorium\}/g, metadata.laboratorium || 'Lab');

  if (!name.toLowerCase().endsWith('.docx')) name += '.docx';
  return name;
}

function pickFilenameFormat(
  global: string | undefined,
  schedule: PracticumSchedule | undefined,
): string {
  if (schedule?.fileNameFormat) return schedule.fileNameFormat;
  return global || DEFAULT_FILENAME;
}

/**
 * Returns a stable `download()` callback (suitable as a button handler
 * and as a window-event listener) plus a `prefetchDocxChunk()` helper
 * the caller can fire on idle so the docx library is warm by the time
 * the user clicks Download.
 *
 * Fixes R8 #5: the legacy effect re-bound the `export-active-session`
 * listener on every render because `handleDownload` was a fresh closure.
 * Here the listener is bound once via a ref-based stable callback that
 * always reads the latest context.
 */
export function useReportDownload(ctx: ReportDownloadCtx): {
  download: () => Promise<void>;
  prefetchDocxChunk: () => void;
} {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const globalFileNameFormat = useAppStore((s) => s.globalFileNameFormat);
  const schedules = useAppStore((s) => s.schedules);
  const globalRef = useRef(globalFileNameFormat);
  const schedulesRef = useRef(schedules);
  globalRef.current = globalFileNameFormat;
  schedulesRef.current = schedules;

  const download = async () => {
    const c = ctxRef.current;
    let blob = c.generatedDocxBlob;
    if (!blob && c.aiPreviewData) {
      let logoBlob: Blob | null = null;
      try {
        const logoRes = await fetch('/logo-uad.png');
        if (logoRes.ok) logoBlob = await logoRes.blob();
      } catch {
        /* logo is optional */
      }

      // Dynamic import of the docx module so the heavy `docx` dep stays
      // out of the initial chunk. The chunk is prefetched on session
      // mount via `prefetchDocxChunk`, so first-click is warm.
      const { generateDocx } = await import('@/lib/docx');
      blob = await generateDocx(
        c.metadata,
        [...c.parsedNotebooks, ...c.postTestParsedNotebooks],
        c.aiPreviewData,
        logoBlob,
        c.preTestImages,
        c.implImages,
        c.postTestImages,
        c.modulContext,
        c.postTest,
        c.parsedNotebooks.length,
      );
      c.setGeneratedDocxBlob(blob);
    }

    if (!blob) {
      toast.error('Please generate the report first before downloading.');
      return;
    }

    const schedule = schedulesRef.current.find(
      (s) => s.mataPraktikum === c.metadata.mataPraktikum,
    );
    const format = pickFilenameFormat(globalRef.current, schedule);
    saveAs(blob, resolveFileName(format, c.metadata));
  };

  /**
   * Prefetch the docx chunk so the first Download click is fast.
   * Safe to call multiple times; the dynamic import is module-level cached.
   */
  const prefetchDocxChunk = (): void => {
    const fire = () => {
      void import('@/lib/docx');
    };
    if (typeof window === 'undefined') return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fire);
    else setTimeout(fire, 0);
  };

  // Bind the export-active-session listener exactly once. The handler is
  // a thin shim that calls the latest `download` via the ref-tied ctx.
  useEffect(() => {
    const handler = () => {
      void download();
    };
    window.addEventListener('export-active-session', handler);
    return () => window.removeEventListener('export-active-session', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { download, prefetchDocxChunk };
}
