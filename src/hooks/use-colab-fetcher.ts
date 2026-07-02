import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { parseNotebook, type ParsedNotebook } from '@/lib/parser';

/**
 * Colab notebook fetcher.
 *
 * Watches `modulContext` and `postTest` for Colab share URLs. For each
 * newly-seen URL, downloads the underlying .ipynb via a chain of CORS
 * proxies, parses it, and invokes the appropriate `onImplAdd` /
 * `onPostTestAdd` callback.
 *
 * The three caches below are deliberately module-level so they survive
 * tab switches and component remounts inside the same page load.
 * They are NOT exported — only this hook reads/writes them.
 *
 *  - `colabCache`    — successful downloads, keyed by the public URL.
 *  - `ongoingFetches` — in-flight promises, so parallel renders dedupe.
 *  - `failedLinks`   — permanent-failure blocklist to prevent re-try spam.
 */

const colabCache = new Map<string, { text: string; parsed: ParsedNotebook }>();
const ongoingFetches = new Map<string, Promise<void>>();
const failedLinks = new Set<string>();

const COLAB_LINK_REGEX = /https:\/\/colab\.research\.google\.com\/drive\/[a-zA-Z0-9_-]+/g;
const FILE_ID_REGEX = /colab\.research\.google\.com\/drive\/([a-zA-Z0-9_-]+)/;

export type ColabAdder = (file: File, parsed: ParsedNotebook) => void;

export interface ColabFetcherArgs {
  modulContext: string;
  postTest: string;
  onImplAdd: ColabAdder;
  onPostTestAdd: ColabAdder;
  autoFetchColab?: boolean;
}

/**
 * Seed the cache from a persisted session's saved files so a tab switch
 * never triggers a fresh download for already-parsed notebooks.
 */
export function seedColabCacheFromSession(
  files: { name: string; content: string }[] | undefined,
  parsedByIndex: ParsedNotebook[],
): void {
  if (!files) return;
  files.forEach((f, idx) => {
    if (!f.content) return;
    const match = f.name.match(/colab_([a-zA-Z0-9_-]+)\.ipynb/);
    if (!match) return;
    const fileId = match[1];
    const link = `https://colab.research.google.com/drive/${fileId}`;
    if (!colabCache.has(link) && parsedByIndex[idx]) {
      colabCache.set(link, { text: f.content, parsed: parsedByIndex[idx] });
    }
  });
}

async function fetchViaProxies(fileId: string): Promise<{ text: string; parsed: ParsedNotebook } | null> {
  const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
  const proxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(downloadUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(downloadUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(downloadUrl)}`,
  ];

  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy);
      if (!response.ok) continue;
      const text = await response.text();
      try {
        const parsed = parseNotebook(text);
        return { text, parsed };
      } catch {
        console.warn(`Proxy ${proxy} returned non-JSON data.`);
      }
    } catch {
      console.warn(`Proxy ${proxy} fetch failed.`);
    }
  }
  return null;
}

export function useColabFetcher(args: ColabFetcherArgs): void {
  const { modulContext, postTest, onImplAdd, onPostTestAdd, autoFetchColab = true } = args;

  // Keep the latest add-callbacks in refs so the effect does not re-bind
  // the listener on every render (the effect only depends on the URL
  // sources; callers pass fresh closures every render).
  const onImplRef = useRef(onImplAdd);
  const onPostRef = useRef(onPostTestAdd);
  onImplRef.current = onImplAdd;
  onPostRef.current = onPostTestAdd;

  useEffect(() => {
    if (!autoFetchColab) return;

    const hydrateFromCache = (link: string, isPostTest: boolean) => {
      const cached = colabCache.get(link);
      if (!cached) return;
      const match = link.match(FILE_ID_REGEX);
      if (!match) return;
      const fileName = `colab_${match[1]}.ipynb`;
      const file = new File([cached.text], fileName, { type: 'application/x-ipynb+json' });
      (isPostTest ? onPostRef.current : onImplRef.current)(file, cached.parsed);
    };

    const fetchOne = async (link: string, isPostTest: boolean): Promise<void> => {
      const match = link.match(FILE_ID_REGEX);
      if (!match) return;
      const fileId = match[1];

      if (failedLinks.has(link)) return;
      if (colabCache.has(link)) {
        hydrateFromCache(link, isPostTest);
        return;
      }
      if (ongoingFetches.has(link)) {
        await ongoingFetches.get(link);
        if (colabCache.has(link)) hydrateFromCache(link, isPostTest);
        return;
      }

      const fetchPromise = (async () => {
        const loadingToastId = toast.loading(`Mengunduh Colab: ${fileId.substring(0, 8)}...`);
        try {
          const result = await fetchViaProxies(fileId);
          if (!result) {
            throw new Error(
              'Semua proxy gagal atau file tidak dibagikan publik. (Ubah akses ke "Anyone with the link").',
            );
          }
          colabCache.set(link, result);
          toast.success('Berhasil mengunduh Colab', { id: loadingToastId });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error('Colab download error:', error);
          failedLinks.add(link);
          toast.error(`Gagal mengunduh Colab: ${msg}`, { id: loadingToastId });
        } finally {
          ongoingFetches.delete(link);
        }
      })();

      ongoingFetches.set(link, fetchPromise);
      await fetchPromise;
      if (colabCache.has(link)) hydrateFromCache(link, isPostTest);
    };

    const modulLinks = modulContext.match(COLAB_LINK_REGEX) || [];
    modulLinks.forEach((link) => {
      void fetchOne(link, false);
    });
    const ptLinks = postTest.match(COLAB_LINK_REGEX) || [];
    ptLinks.forEach((link) => {
      void fetchOne(link, true);
    });
  }, [modulContext, postTest, autoFetchColab]);
}
