// One open window's chrome and gestures (ticket 04 § Behaviour, ticket 14 § Round 2,
// ticket 06 § focus signalling). Pointer events only — `pointerdown` +
// `setPointerCapture` — never mouse events and never a drag library (map Hazards).
// Geometry math itself lives in `./geometry`; this component's job is turning a
// pointer gesture into calls against that pure module and the store, and rendering
// the result.
//
// Z-order (ticket 14 § "Z-order never reorders the DOM"): this component never moves
// itself in the DOM. `Desktop.tsx` maps `windows` in open order every render; only
// the `zIndex` inline style here changes on focus/raise.
import { useCallback, useEffect, useRef } from 'react';
import {
  magnetise,
  resize,
  snapRect,
  snapTarget,
  tearOff,
  type Rect,
  type ResizeHandle,
  type SnapZone,
} from './geometry';
import { useShellStore, type ShellWindow } from '../store';

/** How far a pointer must move, in px, before a press on the title bar counts as an
 * intentional drag rather than a click — and, for an already-snapped window, before
 * it tears free (ticket 04: "the first pointer movement past some small threshold"). */
const DRAG_THRESHOLD = 4;

const RESIZE_HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

type Gesture =
  | {
      kind: 'drag';
      pointerId: number;
      startPointer: { x: number; y: number };
      startRect: Rect;
      torn: boolean;
    }
  | {
      kind: 'resize';
      pointerId: number;
      handle: ResizeHandle;
      startPointer: { x: number; y: number };
      startRect: Rect;
    };

interface Props {
  win: ShellWindow;
  /** Every open window, including this one — the drag handler filters out itself,
   * anything snapped, and anything minimised before calling `magnetise` (ticket 04:
   * magnetism is free-windows-only, and the caller is what excludes snapped ones). */
  allWindows: ShellWindow[];
  desktopSize: { width: number; height: number };
  /** The desktop surface's own element, read (not stored) on each gesture so a
   * pointer's `clientX`/`clientY` can be converted into the desktop-relative
   * coordinates every geometry function expects. */
  desktopRef: React.RefObject<HTMLDivElement | null>;
  /** Reports the live snap zone during a drag, or `null` once it's not armed —
   * `Desktop.tsx` renders `SnapPreview` off this. */
  onDragSnapChange: (zone: SnapZone | null) => void;
  /** Resolves ticket 14's focus-on-close priority, which needs the DOM node this
   * component owns — `close()` itself only returns a descriptor (`store.ts`). */
  onClose: (id: string) => void;
  /** Registers/unregisters this window's `h2` so `Desktop.tsx` can move focus to it
   * (ticket 14: opening moves focus to the title; closing may return it to another
   * window's title). */
  headingRef: (el: HTMLHeadingElement | null) => void;
  /** Phase 10's real maximise link, present iff the underlying node has a URL
   * (ticket 09). Phase 9's windows hold placeholder bodies and never pass this. */
  maximiseSlot?: React.ReactNode;
}

export default function Window({
  win,
  allWindows,
  desktopSize,
  desktopRef,
  onDragSnapChange,
  onClose,
  headingRef,
  maximiseSlot,
}: Props) {
  const tree = useShellStore((state) => state.tree);
  const focusedId = useShellStore((state) => state.focusedId);
  const focus = useShellStore((state) => state.focus);
  const minimise = useShellStore((state) => state.minimise);
  const setRect = useShellStore((state) => state.setRect);
  const snap = useShellStore((state) => state.snap);
  const unsnap = useShellStore((state) => state.unsnap);

  const node = tree?.[win.path];
  // The filename shown in a title bar (Frame's own convention, `Section.astro`:
  // `title={node.name}` — human titles are for the maximise box's accessible name,
  // never the chrome).
  const title = node?.name ?? win.path.split('/').filter(Boolean).pop() ?? win.path;

  const gestureRef = useRef<Gesture | null>(null);
  const pendingRectRef = useRef<Rect>(win.rect);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const flush = useCallback(() => {
    rafRef.current = null;
    setRect(win.id, pendingRectRef.current);
  }, [setRect, win.id]);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flush);
  }, [flush]);

  function toDesktopPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = desktopRef.current?.getBoundingClientRect();
    if (!rect) return { x: e.clientX, y: e.clientY };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function freeOtherRects(): Rect[] {
    return allWindows
      .filter((w) => w.id !== win.id && !w.snapped && !w.minimised)
      .map((w) => w.rect);
  }

  function handleTitlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLElement && e.target.closest('button, a')) return;
    focus(win.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current = {
      kind: 'drag',
      pointerId: e.pointerId,
      startPointer: { x: e.clientX, y: e.clientY },
      startRect: win.rect,
      torn: false,
    };
  }

  function handleTitlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.kind !== 'drag' || g.pointerId !== e.pointerId) return;

    const dx = e.clientX - g.startPointer.x;
    const dy = e.clientY - g.startPointer.y;

    if (win.snapped && !g.torn) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Ticket 04: the first movement past the threshold tears a snapped/maximised
      // window free, back to its pre-snap size centred under the cursor.
      const restoreSize = win.restoreRect ?? win.rect;
      const pointer = toDesktopPoint(e);
      const torn = tearOff(win.rect, restoreSize, pointer);
      unsnap(win.id);
      g.torn = true;
      g.startRect = torn;
      g.startPointer = { x: e.clientX, y: e.clientY };
      pendingRectRef.current = torn;
      scheduleFlush();
      return;
    }

    const next: Rect = { ...g.startRect, x: g.startRect.x + dx, y: g.startRect.y + dy };
    pendingRectRef.current = next;
    onDragSnapChange(snapTarget(toDesktopPoint(e), desktopSize));
    scheduleFlush();
  }

  function endDragOrResize(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    gestureRef.current = null;

    if (g.kind === 'resize') {
      setRect(win.id, pendingRectRef.current);
      return;
    }

    onDragSnapChange(null);
    const zone = snapTarget(toDesktopPoint(e), desktopSize);
    if (zone) {
      snap(win.id, zone, snapRect(zone, desktopSize));
      return;
    }
    // Only free (unsnapped) windows magnetise (ticket 04) — `g.torn` covers a
    // window that started this gesture snapped and tore free mid-drag.
    const magnetised = magnetise(pendingRectRef.current, freeOtherRects(), desktopSize);
    setRect(win.id, magnetised);
  }

  function handleTitlePointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    gestureRef.current = null;
    onDragSnapChange(null);
    setRect(win.id, pendingRectRef.current);
  }

  function toggleMaximise() {
    if (win.snapped) {
      unsnap(win.id);
      if (win.restoreRect) setRect(win.id, win.restoreRect);
    } else {
      snap(win.id, 'top', snapRect('top', desktopSize));
    }
  }

  function handleResizePointerDown(handle: ResizeHandle) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      focus(win.id);
      e.currentTarget.setPointerCapture(e.pointerId);
      gestureRef.current = {
        kind: 'resize',
        pointerId: e.pointerId,
        handle,
        startPointer: { x: e.clientX, y: e.clientY },
        startRect: win.rect,
      };
    };
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.kind !== 'resize' || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startPointer.x;
    const dy = e.clientY - g.startPointer.y;
    pendingRectRef.current = resize(g.startRect, g.handle, dx, dy);
    scheduleFlush();
  }

  const focused = win.id === focusedId;

  return (
    <section
      className="frame"
      style={{
        position: 'absolute',
        left: win.rect.x,
        top: win.rect.y,
        width: win.rect.width,
        height: win.rect.height,
        zIndex: win.z,
        display: win.minimised ? 'none' : undefined,
      }}
      data-focused={focused || undefined}
      data-window={win.id}
      data-rect-x={win.rect.x}
      data-rect-y={win.rect.y}
      data-rect-w={win.rect.width}
      data-rect-h={win.rect.height}
      onFocus={() => focus(win.id)}
    >
      <div
        className="titlebar scan bloom"
        data-lit={focused || undefined}
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={endDragOrResize}
        onPointerCancel={handleTitlePointerCancel}
        onDoubleClick={toggleMaximise}
      >
        <h2 id={`${win.id}-title`} tabIndex={-1} ref={headingRef}>
          {title}
        </h2>
        {maximiseSlot}
        <button
          type="button"
          className="ctl minbox"
          aria-label={`Minimise ${title}`}
          onClick={() => minimise(win.id)}
        >
          _
        </button>
        <button
          type="button"
          className="ctl closebox"
          aria-label={`Close ${title}`}
          onClick={() => onClose(win.id)}
        >
          X
        </button>
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- ticket 14:
          "a body that scrolls is its own focus stop" (WCAG technique G202 for
          keyboard access to scrollable content). Phase 9's placeholder body never
          overflows, but the container is built to take that stop from day one. */}
      <div className="window-body" tabIndex={0}>
        <p>{win.path}</p>
      </div>
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={`resize-handle resize-${handle}`}
          style={{ cursor: HANDLE_CURSOR[handle] }}
          onPointerDown={handleResizePointerDown(handle)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={endDragOrResize}
          onPointerCancel={endDragOrResize}
        />
      ))}
    </section>
  );
}
