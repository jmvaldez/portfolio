// The shell's own taskbar (glossary "Taskbar"; ticket 06 § gauges; ticket 14 §
// taskbar buttons; D18). A separate React component from `TaskbarStrip.astro`
// (Phase 4/11's linear-layout/page strip) even though both are "the fixed bottom
// strip": that one has no shell to report on (no gauges, no window buttons, per its
// own doc comment) and is server-rendered; this one is live shell state.
import { useEffect, useState } from 'react';
import { mounts, type CollectionMount, type RootFileMount } from '~/fs/mounts';
import type { FsNode, FsTree } from '~/fs/types';
import { CRT_KEY } from '~/lib/storage';
import { appRegistry } from './apps/registry';
import { launch } from './launch';
import { useShellStore, type ShellWindow } from './store';

const MAX_GAUGE_BARS = 5;

function isLauncherMount(mount: (typeof mounts)[number]): mount is RootFileMount | CollectionMount {
  return (mount.kind === 'file' || mount.kind === 'collection') && Boolean(mount.launcher);
}

/** Mirrors `DesktopIcons.tsx`'s own guard: an unregistered `app` node is not
 * launchable, so it gets no launcher either (ticket 05, D16's rule generalised). */
function isLaunchable(node: FsNode): boolean {
  return node.kind !== 'app' || (node.app !== undefined && node.app in appRegistry);
}

/** D18: 5 bars running, 0 standby. Takes the union as a parameter (rather than
 * comparing the module-level constant below inline) so TS doesn't narrow the
 * always-`'standby'` constant down to its literal type and flag the `'running'`
 * branch as unreachable — this reads as live state once Task 10.4 wires the real
 * `effects.vector` field in. */
function vectorBars(vector: 'running' | 'standby'): number {
  return vector === 'running' ? MAX_GAUGE_BARS : 0;
}

/** A fixed-width bar gauge (ticket 06 § gauges, D18): `lit` of `MAX_GAUGE_BARS`
 * segments lit, clamped both ends. */
function Gauge({ label, lit }: { label: string; lit: number }) {
  const clamped = Math.max(0, Math.min(MAX_GAUGE_BARS, lit));
  return (
    <span className="gauge">
      {label}{' '}
      <span className="bars" aria-hidden="true">
        {Array.from({ length: MAX_GAUGE_BARS }, (_, i) => (
          <s key={i} className={i < clamped ? 'lit' : undefined} />
        ))}
      </span>
    </span>
  );
}

/** Reads/writes the same `vos:crt` key and `data-crt` attribute as
 * `CrtPrefScript.astro`'s inline script (Task 3.x), so the astro-side toggle (on
 * content pages, and on the linear layout hidden behind the shell) and this
 * shell-side toggle never disagree. Unlike `CrtToggle.astro` this needs no
 * `hidden`-until-`DOMContentLoaded` dance: the shell is a `client:only` island, so by
 * the time this ever renders the inline head script has already run and stamped
 * `data-crt` on `<html>`. */
function CrtToggle() {
  const [on, setOn] = useState(() => document.documentElement.dataset.crt !== 'off');

  function toggle() {
    const next = on ? 'off' : 'on';
    document.documentElement.dataset.crt = next;
    try {
      localStorage.setItem(CRT_KEY, next);
    } catch {
      // Private browsing etc.: the preference just doesn't persist this time.
    }
    setOn(next === 'on');
  }

  return (
    <button type="button" className="ctl crt-toggle" aria-pressed={on} onClick={toggle}>
      CRT
    </button>
  );
}

/** 24-hour, minute granularity — plenty for a HUD clock, and cheaper than
 * per-second re-renders. */
function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return <span className="taskbar-clock bloom">{`${hh}:${mm}`}</span>;
}

function windowLabel(win: ShellWindow, tree: FsTree | null): string {
  return tree?.[win.path]?.name ?? win.path;
}

export default function Taskbar() {
  const tree = useShellStore((state) => state.tree);
  const windows = useShellStore((state) => state.windows);
  const focusedId = useShellStore((state) => state.focusedId);
  const focus = useShellStore((state) => state.focus);
  const minimise = useShellStore((state) => state.minimise);
  const restore = useShellStore((state) => state.restore);
  // Task 10.4: the `effects` slice now exists, so `VEC` reads the live value —
  // `'standby'` until Phase 12 ever sets it to `'running'`.
  const vector = useShellStore((state) => state.effects.vector);

  const launchers = mounts
    .filter(isLauncherMount)
    .map((mount) => tree?.[mount.path])
    .filter((node): node is FsNode => node !== undefined && isLaunchable(node));

  function handleWindowButtonClick(win: ShellWindow) {
    if (win.minimised) {
      restore(win.id);
      focus(win.id);
      // The window's title only becomes focusable again once its `display: none` is
      // lifted by the re-render the two calls above trigger.
      requestAnimationFrame(() => {
        document.getElementById(`${win.id}-title`)?.focus();
      });
    } else if (win.id === focusedId) {
      minimise(win.id);
    } else {
      focus(win.id);
      requestAnimationFrame(() => {
        document.getElementById(`${win.id}-title`)?.focus();
      });
    }
  }

  return (
    <nav className="frame scan taskbar" aria-label="Taskbar">
      <ul className="taskbar-launchers">
        {launchers.map((node) => (
          <li key={node.path}>
            <button type="button" onClick={() => launch(node)}>
              {node.name}
            </button>
          </li>
        ))}
      </ul>
      <ul className="taskbar-windows">
        {windows.map((win) => (
          <li key={win.id}>
            <button
              type="button"
              aria-pressed={!win.minimised}
              onClick={() => handleWindowButtonClick(win)}
            >
              {windowLabel(win, tree)}
            </button>
          </li>
        ))}
      </ul>
      <span className="taskbar-gauges">
        <Gauge label="WIN" lit={windows.length} />
        <Gauge label="VEC" lit={vectorBars(vector)} />
      </span>
      <CrtToggle />
      <Clock />
    </nav>
  );
}
