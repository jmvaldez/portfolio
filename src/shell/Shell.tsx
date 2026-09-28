// The island root (ticket 01: `client:only="react"`; D9: `tree` arrives as
// serialised props, never a fetch). Mounted in `index.astro` as
// `<Shell client:only="react" tree={tree} />`. Owns three things `HeadGate.astro`
// can't: the live two-way breakpoint swap (ticket 11 § Crossing it mid-session), the
// readiness handshake that turns the boot/restore screen into `shell-ready`
// (ticket 10 § Timing, ticket 14 § Boot and resume), and mounting `Desktop.tsx`.
//
// Never calls `.focus()` on the passive boot/restore-ready path (map Hazards:
// moving focus on boot completion strands screen-reader users) — only the widen
// case moves focus, because it's a deliberate viewport-driven mode switch
// (ticket 14 § Live swap).
import { useEffect, useRef, useState } from 'react';
import { SHELL_QUERY } from '~/lib/breakpoint';
import { getLayoutOverride } from '~/lib/storage';
import type { FsTree } from '~/fs/types';
import Desktop, { type DesktopHandle } from './Desktop';
import { useShellStore } from './store';

interface Props {
  tree: FsTree;
}

export default function Shell({ tree }: Props) {
  const [renderDesktop, setRenderDesktop] = useState<boolean>(
    () => !getLayoutOverride() && window.matchMedia(SHELL_QUERY).matches,
  );
  const desktopRef = useRef<DesktopHandle>(null);
  // Set by the widen branch of the media-query listener, consumed once by the
  // readiness effect below: a widen's readiness handshake announces and focuses
  // differently from the passive initial boot/restore (ticket 14 § Live swap).
  const widenPendingRef = useRef(false);

  useEffect(() => {
    useShellStore.getState().setTree(tree);
  }, [tree]);

  useEffect(() => {
    useShellStore.getState().setSurface(renderDesktop ? 'shell' : 'linear');
  }, [renderDesktop]);

  // The live two-way swap (ticket 11 § Crossing it mid-session): subscribed for the
  // lifetime of the island, not just checked once at mount.
  useEffect(() => {
    const mql = window.matchMedia(SHELL_QUERY);

    function handleChange(event: MediaQueryListEvent): void {
      // The layout override outranks the breakpoint either way (glossary "Layout
      // override"); a visitor who skipped to the linear layout stays there
      // regardless of how the viewport moves.
      if (getLayoutOverride()) return;

      const html = document.documentElement;

      if (!event.matches) {
        // Narrowing past the breakpoint: unmount the desktop (its layout is
        // already in `sessionStorage`, Phase 9/10), let the linear layout
        // reappear, and land focus on its `h1` — there's no real window-focus
        // tracking yet in Phase 8, so this is the fallback the phase doc names;
        // Phase 9/10 should check the actually-focused window's root mount first.
        html.classList.remove('shell', 'shell-ready', 'boot', 'restore', 'boot-skipped');
        setRenderDesktop(false);
        useShellStore.getState().announce('Switched to text layout');
        document.querySelector<HTMLHeadingElement>('#linear h1')?.focus();
      } else {
        // Widening back past the breakpoint: show the Restore line, never a boot
        // (ticket 10 § Returning visitor: resume), and remount the desktop
        // through the same readiness handshake as initial mount.
        html.classList.add('shell', 'restore');
        widenPendingRef.current = true;
        setRenderDesktop(true);
      }
    }

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  // The readiness handshake (ticket 10 § Timing, D23; ticket 14 § Boot and resume):
  // runs whenever `Desktop` (re)mounts, whether that's the initial above-the-
  // breakpoint mount or a widen-triggered remount.
  useEffect(() => {
    if (!renderDesktop) return;

    const html = document.documentElement;
    let cancelled = false;

    function ready(): void {
      if (cancelled) return;
      html.classList.add('shell-ready');

      if (widenPendingRef.current) {
        widenPendingRef.current = false;
        // The one focus-moving case: a deliberate viewport-driven mode switch,
        // not passive readiness (ticket 14 § Live swap).
        useShellStore.getState().announce('Switched to desktop');
        desktopRef.current?.focusHeading();
      } else {
        const restoring = html.classList.contains('restore');
        useShellStore.getState().announce(restoring ? 'Desktop restored' : 'Desktop ready');
      }
    }

    if (html.classList.contains('boot')) {
      // D23: the boot holds at least 600 ms. `HeadGate.astro` stamps `bootAt` the
      // moment it adds `html.boot`; a restore (or a widen, which never adds
      // `boot`) has no floor.
      const bootAt = Number(html.dataset.bootAt) || 0;
      const remaining = Math.max(0, 600 - (performance.now() - bootAt));
      const timer = window.setTimeout(ready, remaining);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    ready();
    return () => {
      cancelled = true;
    };
  }, [renderDesktop]);

  const lastAnnouncement = useShellStore((state) => state.lastAnnouncement);

  return (
    <>
      {renderDesktop && <Desktop ref={desktopRef} onSkip={() => setRenderDesktop(false)} />}
      {/* The one shared status region (ticket 14 § Boot and resume, § Live swap,
          § Terminal): boot-ready and live-swap announcements now, toasts in later
          phases. Lives here rather than inside `Desktop` so a narrowing swap's
          "Switched to text layout" announcement survives `Desktop` unmounting in
          the same tick it fires — this component is the island root, so it's
          always mounted. Visually hidden: it's for assistive tech, not a HUD
          element. */}
      <div role="status" aria-live="polite" className="sr-only">
        {lastAnnouncement}
      </div>
    </>
  );
}
