// The island root, mounted in `index.astro` as a `client:only="react"` island with the
// tree as a serialised prop. Owns the live two-way breakpoint swap, the readiness
// handshake that turns the boot/restore screen into `shell-ready`, and mounting `Desktop`.
//
// Never calls `.focus()` on the passive boot/restore-ready path, since moving focus on boot
// completion strands screen-reader users. Only the widen case moves focus, because it is a
// deliberate viewport-driven mode switch.
import { useCallback, useEffect, useRef, useState } from 'react';
import { initAnalytics, track } from '~/analytics';
import { SHELL_QUERY } from '~/lib/breakpoint';
import { getLayoutOverride } from '~/lib/storage';
import type { FsTree } from '~/fs/types';
import Desktop, { type DesktopHandle } from './Desktop';
import { useShellStore } from './store';

interface Props {
  tree: FsTree;
  /** The build-time drone SVG and its HUD readout, shown by `viewer.exe` without WebGL. */
  droneSvg: string;
  droneReadout: string;
}

export default function Shell({ tree, droneSvg, droneReadout }: Props) {
  const [renderDesktop, setRenderDesktop] = useState<boolean>(
    () => !getLayoutOverride() && window.matchMedia(SHELL_QUERY).matches,
  );
  const desktopRef = useRef<DesktopHandle>(null);
  // Set by the widen branch of the media-query listener and consumed once by the readiness
  // effect: a widen announces and focuses differently from the initial boot/restore.
  const widenPendingRef = useRef(false);
  // The readiness announcement reports the window count, which is unknown until `Desktop`'s
  // seed/restore effect has run (after an async `ResizeObserver` callback). These refs gate
  // the announcement on both the boot floor and that effect, whichever finishes last.
  const seededRef = useRef(false);
  const timerDoneRef = useRef(false);
  const readyRef = useRef<(() => void) | null>(null);

  // Starts analytics once the island has mounted; the adapter loads on an idle callback.
  // Whether this mount is the linear layout (mobile, or a stored layout override) is the
  // one handoff decided before the island exists, so it is reported here.
  const startedLinearRef = useRef(!renderDesktop);
  useEffect(() => {
    initAnalytics();
    if (startedLinearRef.current) track('linear_handoff', { reason: 'initial' });
  }, []);

  useEffect(() => {
    useShellStore.getState().setTree(tree);
  }, [tree]);

  useEffect(() => {
    useShellStore.getState().setDroneFallback({ svg: droneSvg, readout: droneReadout });
  }, [droneSvg, droneReadout]);

  useEffect(() => {
    useShellStore.getState().setSurface(renderDesktop ? 'shell' : 'linear');
  }, [renderDesktop]);

  // The live two-way swap between desktop and linear layouts, for the island's lifetime.
  useEffect(() => {
    const mql = window.matchMedia(SHELL_QUERY);

    function handleChange(event: MediaQueryListEvent): void {
      // The layout override outranks the breakpoint: a visitor who skipped to the linear
      // layout stays there however the viewport moves.
      if (getLayoutOverride()) return;

      const html = document.documentElement;

      if (!event.matches) {
        // Narrowing: unmount the desktop (its layout is already persisted), show the linear
        // layout, and focus its `h1`.
        html.classList.remove('shell', 'shell-ready', 'boot', 'restore', 'boot-skipped');
        setRenderDesktop(false);
        useShellStore.getState().announce('Switched to text layout');
        track('linear_handoff', { reason: 'narrowed' });
        document.querySelector<HTMLHeadingElement>('#linear h1')?.focus();
      } else {
        // Widening: show the Restore line, never a boot, and remount the desktop through
        // the same readiness handshake as the initial mount.
        html.classList.add('shell', 'restore');
        widenPendingRef.current = true;
        setRenderDesktop(true);
      }
    }

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  // Returns a plural-aware phrase such as "1 window open" or "2 windows restored".
  function windowCountPhrase(n: number, verb: 'open' | 'restored'): string {
    return `${n} window${n === 1 ? '' : 's'} ${verb}`;
  }

  // Passed to `Desktop` as `onSeeded`; marks the window set as settled.
  const handleSeeded = useCallback(() => {
    seededRef.current = true;
    if (timerDoneRef.current) readyRef.current?.();
  }, []);

  // The readiness handshake; runs whenever `Desktop` (re)mounts, initially or after a widen.
  useEffect(() => {
    if (!renderDesktop) return;

    const html = document.documentElement;
    let cancelled = false;
    seededRef.current = false;
    timerDoneRef.current = false;

    function ready(): void {
      if (cancelled) return;
      html.classList.add('shell-ready');

      if (widenPendingRef.current) {
        widenPendingRef.current = false;
        // The one focus-moving case: a deliberate viewport-driven mode switch.
        useShellStore.getState().announce('Switched to desktop');
        track('shell_entered', { mode: 'widen' });
        desktopRef.current?.focusHeading();
      } else {
        const restoring = html.classList.contains('restore');
        const n = useShellStore.getState().windows.length;
        track('shell_entered', { mode: restoring ? 'restore' : 'boot' });
        useShellStore
          .getState()
          .announce(
            restoring
              ? `Desktop restored, ${windowCountPhrase(n, 'restored')}`
              : `Desktop ready, ${windowCountPhrase(n, 'open')}`,
          );
      }
    }
    readyRef.current = ready;

    function maybeReady(): void {
      if (!cancelled && seededRef.current && timerDoneRef.current) ready();
    }

    if (html.classList.contains('boot')) {
      // The boot holds for at least 600 ms from `HeadGate.astro`'s `bootAt` stamp; a
      // restore or widen has no such floor.
      const bootAt = Number(html.dataset.bootAt) || 0;
      const remaining = Math.max(0, 600 - (performance.now() - bootAt));
      const timer = window.setTimeout(() => {
        timerDoneRef.current = true;
        maybeReady();
      }, remaining);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    timerDoneRef.current = true;
    maybeReady();
    return () => {
      cancelled = true;
    };
  }, [renderDesktop]);

  const lastAnnouncement = useShellStore((state) => state.lastAnnouncement);

  return (
    <>
      {renderDesktop && (
        <Desktop
          ref={desktopRef}
          onSkip={() => {
            track('linear_handoff', { reason: 'skip_link' });
            setRenderDesktop(false);
          }}
          onSeeded={handleSeeded}
        />
      )}
      {/* The one shared status region, for readiness, layout-swap, and toast announcements.
          It lives here so the "Switched to text layout" announcement survives `Desktop`
          unmounting in the same tick. Visually hidden. */}
      <div role="status" aria-live="polite" className="sr-only">
        {lastAnnouncement}
      </div>
    </>
  );
}
