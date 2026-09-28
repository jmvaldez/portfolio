// The shell's taskbar: launchers, window buttons, gauges, CRT toggle, and clock. Separate
// from the server-rendered `TaskbarStrip.astro`, which has no shell state to report.
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

/** Returns whether `node` can be launched; an `app` node with no registered app cannot. */
function isLaunchable(node: FsNode): boolean {
  return node.kind !== 'app' || (node.app !== undefined && node.app in appRegistry);
}

/** Returns the number of lit `VEC` gauge bars: all of them when running, none on standby. */
function vectorBars(vector: 'running' | 'standby'): number {
  return vector === 'running' ? MAX_GAUGE_BARS : 0;
}

/** A fixed-width bar gauge with `lit` of `MAX_GAUGE_BARS` segments lit, clamped to range. */
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

/**
 * The CRT effect toggle. Shares the `vos:crt` key and `data-crt` attribute with
 * `CrtPrefScript.astro` so the astro-side toggle and this one agree. It renders immediately
 * because the island mounts after the head script has stamped `data-crt`.
 */
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

/** A 24-hour `HH:MM` clock that refreshes every 15 seconds. */
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
  const vector = useShellStore((state) => state.effects.vector);

  const launchers = mounts
    .filter(isLauncherMount)
    .map((mount) => tree?.[mount.path])
    .filter((node): node is FsNode => node !== undefined && isLaunchable(node));

  function handleWindowButtonClick(win: ShellWindow) {
    if (win.minimised) {
      restore(win.id);
      focus(win.id);
      // The title is focusable only after the re-render lifts its `display: none`.
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
