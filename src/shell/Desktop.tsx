// The desktop surface: window manager, desktop icons, taskbar, and skip link.
//
// The shared `role="status"` region lives in `Shell.tsx`, not here: narrowing past the
// breakpoint unmounts this component in the same tick it announces "Switched to text
// layout", and a status region removed before a screen reader observes the mutation is
// never read out. `Shell.tsx` is the island root and always exists.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { setLayoutOverride } from '~/lib/storage';
import DesktopIcons from './DesktopIcons';
import { launch } from './launch';
import { applyStoredLayout, initPersistence, restoreLayout } from './persist';
import { clearStalePromotionName } from './promote';
import SceneLayer from './scene/SceneLayer';
import Taskbar from './Taskbar';
import Toasts from './Toasts';
import { rescue, seedToRect, type SeedFraction, type SnapZone } from './wm/geometry';
import MaximiseBox from './wm/MaximiseBox';
import SnapPreview from './wm/SnapPreview';
import Window from './wm/Window';
import WindowBody from './windows/WindowBody';
import { useShellStore } from './store';

/** The Konami code, matched on `KeyboardEvent.code` because `key` for B and A varies
 * under non-QWERTY layouts. */
const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

export interface DesktopHandle {
  /** Focuses the desktop's own h1: the fallback focus target when no window is available. */
  focusHeading: () => void;
}

interface Props {
  /** Called when the skip link is activated; the parent stops rendering `Desktop`. */
  onSkip: () => void;
  /** Called once this mount's window set is settled: seeded, restored from `vos:layout`, or
   * left alone because windows from a previous mount are still in the store. */
  onSeeded?: () => void;
}

/**
 * The first-visit window layout, as fractions of the desktop rather than fixed pixels.
 *
 * Order matters: `store.open()` focuses whatever it opens, so the terminal and viewer are
 * listed first to leave `projects` focused and the terminal unfocused.
 */
const SEEDS: ReadonlyArray<{ path: string; seed: SeedFraction }> = [
  { path: '/bin/terminal.exe', seed: { x: 0.09, y: 0.62, w: 0.32, h: 0.34 } },
  { path: '/bin/viewer.exe', seed: { x: 0.5, y: 0.42, w: 0.34, h: 0.48 } },
  { path: '/about.txt', seed: { x: 0.09, y: 0.06, w: 0.26, h: 0.42 } },
  { path: '/projects', seed: { x: 0.37, y: 0.06, w: 0.28, h: 0.42 } },
];

const Desktop = forwardRef<DesktopHandle, Props>(function Desktop({ onSkip, onSeeded }, ref) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const titleRefs = useRef(new Map<string, HTMLHeadingElement>());
  const seededRef = useRef(false);

  const [desktopSize, setDesktopSize] = useState({ width: 0, height: 0 });
  const [dragSnapZone, setDragSnapZone] = useState<SnapZone | null>(null);

  const windows = useShellStore((state) => state.windows);
  const tree = useShellStore((state) => state.tree);
  const open = useShellStore((state) => state.open);
  const setRect = useShellStore((state) => state.setRect);
  const close = useShellStore((state) => state.close);
  const restore = useShellStore((state) => state.restore);

  useImperativeHandle(ref, () => ({
    focusHeading: () => headingRef.current?.focus(),
  }));

  // Tracks `#desktop`'s box; the seed and rescue effects below both depend on it.
  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDesktopSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keeps every window's title bar reachable when the desktop shrinks. Reads `windows`
  // from the store rather than depending on it, so its own `setRect` calls don't retrigger it.
  useEffect(() => {
    if (desktopSize.width === 0 && desktopSize.height === 0) return;
    for (const win of useShellStore.getState().windows) {
      const rescued = rescue(win.rect, desktopSize);
      if (rescued.x !== win.rect.x || rescued.y !== win.rect.y) {
        setRect(win.id, rescued);
      }
    }
  }, [desktopSize, setRect]);

  // Opens the stored layout, or the seeds, once the desktop has a measured size and the
  // tree is loaded. Focus is deliberately not moved afterward: this is part of the first
  // paint, not an interactive open. A widen remount gets a fresh `seededRef` but the store's
  // windows survive it, so the length check stops a second seeding.
  useEffect(() => {
    if (seededRef.current || !tree) return;
    if (desktopSize.width === 0 && desktopSize.height === 0) return;
    seededRef.current = true;

    if (useShellStore.getState().windows.length === 0) {
      const stored = restoreLayout();
      if (stored && stored.windows.length > 0) {
        applyStoredLayout(stored, tree, desktopSize);
      } else {
        for (const { path, seed } of SEEDS) {
          if (!tree[path]) continue; // Seeds for unregistered apps are skipped.
          open(path);
          setRect(path, seedToRect(seed, desktopSize));
        }
      }
    }
    onSeeded?.();
  }, [tree, desktopSize, open, setRect, onSeeded]);

  // Persists the layout to `vos:layout`; re-wired per mount so remounts never hold two
  // subscriptions.
  useEffect(() => initPersistence(), []);

  // A `view-transition-name` left over from a promotion click must be cleared when a
  // bfcache-restored `/` is shown, or it collides with the next promotion's.
  useEffect(() => {
    window.addEventListener('pageshow', clearStalePromotionName);
    return () => window.removeEventListener('pageshow', clearStalePromotionName);
  }, []);

  // Konami code: ignored while focus is in an editable element, reset on any wrong key.
  useEffect(() => {
    let progress = 0;

    function handleKeyDown(e: KeyboardEvent): void {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      ) {
        return;
      }

      if (e.code === KONAMI_CODE[progress]) {
        progress += 1;
        if (progress === KONAMI_CODE.length) {
          progress = 0;
          useShellStore.getState().setEffects({ gridTint: 'amber' });
          useShellStore.getState().toast('TINT', 'AMBER');
        }
      } else {
        progress = e.code === KONAMI_CODE[0] ? 1 : 0;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Backtick toggles the terminal: opens or focuses it, or minimises it when already
  // focused and returns focus to its previous holder. Ignored during boot and while focus
  // is in a text field other than the terminal's own input.
  useEffect(() => {
    let previouslyFocused: HTMLElement | null = null;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== '`') return;
      // `html.boot` means this tab went through a boot and is not always cleared afterward,
      // so a boot is in progress only while it is set and `shell-ready` is not.
      const html = document.documentElement;
      if (html.classList.contains('boot') && !html.classList.contains('shell-ready')) return;

      const active = document.activeElement;
      const isOwnTerminalInput =
        active instanceof HTMLElement && active.classList.contains('terminal-input');
      if (
        !isOwnTerminalInput &&
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      ) {
        return;
      }

      const node = useShellStore.getState().tree?.['/bin/terminal.exe'];
      if (!node) return;
      e.preventDefault();

      const win = useShellStore.getState().windows.find((w) => w.id === node.path);
      const focusedId = useShellStore.getState().focusedId;

      if (win && !win.minimised && win.id === focusedId) {
        useShellStore.getState().minimise(win.id);
        if (previouslyFocused && document.contains(previouslyFocused)) {
          previouslyFocused.focus();
        } else {
          headingRef.current?.focus();
        }
        previouslyFocused = null;
        return;
      }

      previouslyFocused = active instanceof HTMLElement ? active : null;
      launch(node);
      if (win?.minimised) restore(win.id);
      requestAnimationFrame(() => {
        document.getElementById(`${node.path}-title`)?.focus();
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restore]);

  const handleHeadingRef = useCallback((id: string, el: HTMLHeadingElement | null) => {
    if (el) titleRefs.current.set(id, el);
    else titleRefs.current.delete(id);
  }, []);

  // Turns the focus target that `store.close()` returns into a real `.focus()` call.
  const handleClose = useCallback(
    (id: string) => {
      const target = close(id);
      if (target.type === 'icon') {
        // The desktop heading stands in for an icon as the focus target.
        headingRef.current?.focus();
        return;
      }
      // A `taskbar` target resolves like a `window` target: focus the window's title,
      // unless it is minimised (title is `display: none`), then the desktop heading.
      const win = useShellStore.getState().windows.find((w) => w.id === target.id);
      if (win && !win.minimised) {
        titleRefs.current.get(target.id)?.focus();
      } else {
        headingRef.current?.focus();
      }
    },
    [close],
  );

  function handleSkip(): void {
    // The override makes the linear layout a persistent alternate, not a mobile-only view.
    setLayoutOverride(true);
    document.documentElement.classList.remove('shell', 'shell-ready');
    onSkip();
  }

  return (
    <>
      <h1 className="sr-only" tabIndex={-1} ref={headingRef}>
        valdez-os desktop
      </h1>
      {/* First in the natural tab order: the `h1` above is only programmatically focusable.
          Hidden only by its own focus-visibility CSS. */}
      <button type="button" className="skip-link" onClick={handleSkip}>
        Skip to text layout
      </button>
      {/* `#desktop` stays transparent so the shared WebGL canvas shows through; the ground
          fill lives on `body`. The canvas precedes `#desktop` in the DOM so it paints beneath. */}
      <SceneLayer desktopRef={desktopRef} />
      <div id="desktop" ref={desktopRef}>
        <DesktopIcons />
        {windows.map((win) => {
          const node = tree?.[win.id];
          // `exactOptionalPropertyTypes`: an absent maximise box must be an absent key.
          const maximiseProps = node?.url ? { maximiseSlot: <MaximiseBox node={node} /> } : {};
          return (
            <Window
              key={win.id}
              win={win}
              allWindows={windows}
              desktopSize={desktopSize}
              desktopRef={desktopRef}
              onDragSnapChange={setDragSnapZone}
              onClose={handleClose}
              headingRef={(el) => handleHeadingRef(win.id, el)}
              {...maximiseProps}
            >
              <WindowBody node={node} windowId={win.id} />
            </Window>
          );
        })}
        {dragSnapZone && <SnapPreview zone={dragSnapZone} desktop={desktopSize} />}
      </div>
      <Toasts />
      <Taskbar />
    </>
  );
});

export default Desktop;
