// The desktop surface (ticket 14 § Shell structure, § Round 2; map Hazards: the skip
// link and the opaque-surface trap). Phase 9 grows `#desktop` into the window
// manager itself — Phase 10 adds the desktop icons and the taskbar on top of it.
//
// The shared `role="status"` region lives in `Shell.tsx`, not here, even though the
// phase doc lists it under `Desktop`: narrowing past the breakpoint unmounts this
// component in the same tick it announces "Switched to text layout" (ticket 14
// § Live swap), and a status region that's removed before a screen reader observes
// the mutation never gets read out. `Shell.tsx` always exists (it's the island root),
// so hosting the region there is the only way that announcement survives.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { setLayoutOverride } from '~/lib/storage';
import DesktopIcons from './DesktopIcons';
import { applyStoredLayout, initPersistence, restoreLayout } from './persist';
import { clearStalePromotionName } from './promote';
import Taskbar from './Taskbar';
import Toasts from './Toasts';
import { rescue, seedToRect, type SeedFraction, type SnapZone } from './wm/geometry';
import MaximiseBox from './wm/MaximiseBox';
import SnapPreview from './wm/SnapPreview';
import Window from './wm/Window';
import WindowBody from './windows/WindowBody';
import { useShellStore } from './store';

/** The Konami code (Task 10.4, ticket 08 § Easter eggs), matched on `KeyboardEvent`'s
 * layout-independent `code` rather than `key` — `ArrowUp` etc. are already
 * layout-independent, but `KeyB`/`KeyA` are not the same as `key === 'b'/'a'` under a
 * non-QWERTY layout. */
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
  /** Focuses the desktop's own h1 — the widen fallback (ticket 14 § Live swap:
   * "else the desktop h1") when there's no counterpart window yet to focus, and
   * ticket 14's own "first desktop icon" fallback for `close()`'s focus target
   * (Phase 9 has no desktop icons yet — Phase 10 — so this heading stands in). */
  focusHeading: () => void;
}

interface Props {
  /** Called when the skip link is activated: `Shell.tsx` stops rendering `Desktop`
   * from then on. `Desktop` itself only sets the override and drops the `shell`
   * class; it never decides whether it keeps rendering. */
  onSkip: () => void;
  /** Fires once this mount's window set is settled — either D16's seed, a restored
   * `vos:layout`, or (a widen remount, ticket 11 § Crossing it mid-session) skipped
   * outright because windows from the previous mount are still in the store.
   * `Shell.tsx`'s readiness announcement (ticket 14 § Boot and resume) waits on this
   * so it never reads `windows.length` before the async `ResizeObserver` round trip
   * that gates this effect has actually run (Task 10.3). */
  onSeeded?: () => void;
}

/** D16's seed layout, as fractions of the desktop — never fixed pixels (map Hazards).
 * `viewer.exe` and `terminal.exe` are omitted entirely: D16 says "a seed whose app is
 * not yet registered is skipped", and neither app exists in the mount table yet
 * (Phase 12 and Phase 11 respectively add them) — there is no node at either path for
 * `tree` to even resolve, so skipping is unconditional rather than a per-render check. */
const SEEDS: ReadonlyArray<{ path: string; seed: SeedFraction }> = [
  { path: '/about.txt', seed: { x: 0.04, y: 0.06, w: 0.26, h: 0.42 } },
  { path: '/projects', seed: { x: 0.33, y: 0.06, w: 0.28, h: 0.42 } },
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

  useImperativeHandle(ref, () => ({
    focusHeading: () => headingRef.current?.focus(),
  }));

  // Tracks `#desktop`'s own box live (Task 9.4 § rescue clamp) — the same
  // measurement both the seed effect converts D16's fractions against and the
  // rescue effect below reacts to.
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

  // Task 9.4: a floor ahead of ticket 11's own breakpoint listener — every window's
  // title bar stays reachable through the moments before that listener fires. Reads
  // `windows` fresh from the store rather than depending on it, so the pass this
  // effect itself causes (via `setRect`) never re-triggers itself.
  useEffect(() => {
    if (desktopSize.width === 0 && desktopSize.height === 0) return;
    for (const win of useShellStore.getState().windows) {
      const rescued = rescue(win.rect, desktopSize);
      if (rescued.x !== win.rect.x || rescued.y !== win.rect.y) {
        setRect(win.id, rescued);
      }
    }
  }, [desktopSize, setRect]);

  // D16's seed layout, or Task 10.3's restored `vos:layout` — opened once the
  // desktop has both a real size to convert fractions (or rescue stored rects)
  // against and a tree to check registration against. Deliberately calls `open()`/
  // `applyStoredLayout()` directly rather than moving focus to any window afterward
  // — ticket 14 § Boot and resume: "focus is not moved" on the passive ready path,
  // and this seeding is part of that same first paint, not an interactive open. A
  // widen remount (ticket 11) re-runs this effect against a fresh `seededRef`, but
  // the store's own `windows` survive the remount — the length check below is what
  // stops it from re-seeding or re-restoring on top of what's already there.
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
          if (!tree[path]) continue; // D16: an unregistered app's seed is skipped
          open(path);
          setRect(path, seedToRect(seed, desktopSize));
        }
      }
    }
    onSeeded?.();
  }, [tree, desktopSize, open, setRect, onSeeded]);

  // Task 10.3: writes `vos:layout` on every committed windows-related change
  // (debounced) and synchronously on `pagehide`. Re-wired on every mount/unmount —
  // cheap, and it keeps a narrow/widen remount from ever holding two subscriptions.
  useEffect(() => initPersistence(), []);

  // Map Hazards: a leftover inline `view-transition-name` from a promotion click
  // must be cleared if the visitor navigates back into a bfcache-restored `/`
  // (Task 10.3), or it collides with the next promotion's own assignment.
  useEffect(() => {
    window.addEventListener('pageshow', clearStalePromotionName);
    return () => window.removeEventListener('pageshow', clearStalePromotionName);
  }, []);

  // The Konami code (Task 10.4, ticket 08 § Easter eggs): ignored while focus is in
  // a text input/textarea/contenteditable element, reset on any wrong key. Delivers
  // only the state change and the toast here — the visual grid tint is Phase 12's.
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

  const handleHeadingRef = useCallback((id: string, el: HTMLHeadingElement | null) => {
    if (el) titleRefs.current.set(id, el);
    else titleRefs.current.delete(id);
  }, []);

  // Resolves ticket 14's focus-on-close priority into a real `.focus()` call —
  // `store.close()` only returns a descriptor, since it has no DOM nodes to call
  // `.focus()` on itself.
  const handleClose = useCallback(
    (id: string) => {
      const target = close(id);
      if (target.type === 'icon') {
        // Ticket 14's own fallback ("first desktop icon") doesn't exist yet
        // (Phase 10) — the desktop heading is the best available stand-in.
        headingRef.current?.focus();
        return;
      }
      // Phase 9 has no shell taskbar yet either (Phase 10), so a `taskbar` target
      // resolves the same way a `window` target does: focus now lives on the
      // window itself, which is exactly what a taskbar button or the reopened
      // opener would otherwise hand focus to — unless that window is minimised,
      // in which case its title is hidden (`display: none`) and unfocusable, so
      // the desktop heading is the fallback instead.
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
    // Ticket 14 § Strategy: sets the layout override, which is what makes the
    // linear layout a conforming alternate version rather than a mobile-only view.
    setLayoutOverride(true);
    document.documentElement.classList.remove('shell', 'shell-ready');
    onSkip();
  }

  return (
    <>
      <h1 className="sr-only" tabIndex={-1} ref={headingRef}>
        valdez-os desktop
      </h1>
      {/* The literal first Tab stop (ticket 14 § "carries a skip link, first in the
          tab order"): the `h1` above is only programmatically focusable
          (`tabIndex={-1}`), so this button is genuinely first in the natural tab
          sequence. Never hidden by anything other than its own focus-visibility
          CSS (map Hazards). */}
      <button type="button" className="skip-link" onClick={handleSkip}>
        Skip to text layout
      </button>
      {/* Map Hazards: an opaque `#desktop` background silently hides whatever sits
          behind it — Phase 12's shared WebGL canvas will eventually go there. The
          ground fill belongs on an ancestor (`body`, `global.css`); this surface
          stays transparent on purpose. */}
      <div id="desktop" ref={desktopRef}>
        <DesktopIcons />
        {windows.map((win) => {
          const node = tree?.[win.id];
          // `exactOptionalPropertyTypes`: an absent maximise box must be an absent
          // key, not an explicit `undefined` value (same convention as `store.ts`'s
          // own `opener`).
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
