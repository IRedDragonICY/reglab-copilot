import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import type { ReportMetadata, ReportSession } from '@/lib/types';

/**
 * Debounce-saves a session's metadata to IndexedDB whenever `metadata`
 * changes. The debounce window is 500 ms — short enough to feel
 * synchronous, long enough to coalesce a typing storm.
 *
 * Fixes R8 #3: the legacy `useEffect([metadata])` fired on the first
 * render too, causing a redundant IDB write every time a tab opened.
 * The `firstMount` ref skips that initial invocation.
 */
export function useSessionAutosave(
  session: ReportSession | null | undefined,
  metadata: ReportMetadata,
): void {
  const saveSession = useAppStore((s) => s.saveSession);
  const firstMount = useRef(true);

  useEffect(() => {
    if (!session) return;
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    const t = setTimeout(() => {
      saveSession({ ...session, metadata: { ...metadata } });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata]);
}
