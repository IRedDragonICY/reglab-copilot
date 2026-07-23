/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster, toast } from 'sonner';
import AppMain from './components/AppMain';
import { BootSkeleton } from './components/boot-skeleton';
import { useAppStore } from './lib/store';

/**
 * Root shell.
 *
 * Pre-hydration (`hasHydrated === false`):
 *   - Render `<BootSkeleton />` so the user sees the silhouette of the
 *     final UI rather than the empty-state flash that used to surface
 *     "No schedules yet / No reports yet" before IDB resolved.
 *
 * Post-hydration:
 *   - Mount `<AppMain />` and let it own everything else.
 *
 * The transition is a 150ms cross-fade: when `hasHydrated` flips to
 * `true` we keep the skeleton in the tree for one frame with
 * `fadingOut`, then unmount. This avoids a hard jump for users who
 * had a cached payload that resolves in <50ms.
 */
export default function App() {
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!hasHydrated || !skeletonVisible) return;
    // Start the fade on the next frame, then unmount after the CSS
    // transition completes.
    const fadeFrame = requestAnimationFrame(() => setFadingOut(true));
    const unmountTimer = setTimeout(() => setSkeletonVisible(false), 200);
    return () => {
      cancelAnimationFrame(fadeFrame);
      clearTimeout(unmountTimer);
    };
  }, [hasHydrated, skeletonVisible]);

  // Storage error path — emit a single toast when the persist layer
  // signals via the custom event from `store.ts`.
  useEffect(() => {
    const onErr = () => {
      toast.error("Storage unavailable. Changes won't persist this session.");
    };
    window.addEventListener('boot:hydration-failed', onErr);
    return () => window.removeEventListener('boot:hydration-failed', onErr);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {hasHydrated && <AppMain />}
      {skeletonVisible && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <BootSkeleton fadingOut={fadingOut} />
        </div>
      )}
      <Toaster />
    </ThemeProvider>
  );
}
