// One open window's chrome and gestures. Uses pointer events with `setPointerCapture`, not
// mouse events or a drag library. The geometry math lives in `./geometry`; this component
// turns pointer gestures into calls against it and the store.
//
// Z-order never reorders the DOM: `Desktop.tsx` renders windows in open order, and only the
// inline `zIndex` here changes on focus or raise.
import { useCallback, useEffect, useRef } from 'react';
import {
  magnetise,
  rescue,
  resize,
  snapRect,
  snapTarget,
  tearOff,
  type Rect,
  type ResizeHandle,
  type SnapZone,
} from './geometry';
import { useShellStore, type ShellWindow } from '../store';

/** How far a pointer must move, in px, before a title-bar press counts as a drag rather
 * than a click, and before a snapped window tears free. */
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
  /** Every open window, including this one. Dragging excludes itself and any snapped or
   * minimised window from magnetism. */
  allWindows: ShellWindow[];
  desktopSize: { width: number; height: number };
  /** The desktop element, used to convert pointer coordinates to desktop-relative ones. */
  desktopRef: React.RefObject<HTMLDivElement | null>;
  /** Reports the snap zone armed during a drag, or `null` when none is. */
  onDragSnapChange: (zone: SnapZone | null) => void;
  /** Called with the window's id when its close box is activated. */
  onClose: (id: string) => void;
  /** Registers this window's title `h2` (`null` on unmount) so `Desktop.tsx` can focus it. */
  headingRef: (el: HTMLHeadingElement | null) => void;
  /** The maximise link, present only when the node has a URL. */
  maximiseSlot?: React.ReactNode;
  /** The window's body content, rendered inside the scrollable `.window-body`. */
  children?: React.ReactNode;
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
  children,
}: Props) {
  const tree = useShellStore((state) => state.tree);
  const focusedId = useShellStore((state) => state.focusedId);
  const focus = useShellStore((state) => state.focus);
  const minimise = useShellStore((state) => state.minimise);
  const setRect = useShellStore((state) => state.setRect);
  const snap = useShellStore((state) => state.snap);
  const unsnap = useShellStore((state) => state.unsnap);
  const setBodyScroll = useShellStore((state) => state.setBodyScroll);

  const node = tree?.[win.path];
  // Title bars show the filename, not the human title, matching `Section.astro`.
  const title = node?.name ?? win.path.split('/').filter(Boolean).pop() ?? win.path;

  const gestureRef = useRef<Gesture | null>(null);
  const pendingRectRef = useRef<Rect>(win.rect);
  const rafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    },
    [],
  );

  // Records `.window-body`'s scroll position for `persist.ts`, throttled to one update per
  // animation frame like drag and resize.
  const handleBodyScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      if (scrollRafRef.current != null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        setBodyScroll(win.id, scrollTop);
      });
    },
    [setBodyScroll, win.id],
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
      // The first movement past the threshold tears a snapped or maximised window free,
      // back to its pre-snap size centred under the cursor.
      const restoreSize = win.restoreRect ?? win.rect;
      const pointer = toDesktopPoint(e);
      // `tearOff` applies no bounds, so a tear near an edge of a maximised window can put
      // the title bar off-screen, and Chromium may then fire `pointercancel` and strand the
      // gesture. Only the rect rendered for this first frame is clamped: `g.startRect` keeps
      // the unclamped result, because later moves add `dx`/`dy` to it to hold the window
      // centred under the cursor, and a clamped start would offset it for the whole drag.
      // The next `pointermove` overwrites the clamped rect.
      const torn = tearOff(win.rect, restoreSize, pointer);
      unsnap(win.id);
      g.torn = true;
      g.startRect = torn;
      g.startPointer = { x: e.clientX, y: e.clientY };
      pendingRectRef.current = rescue(torn, desktopSize);
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
    // Only free windows magnetise; this includes one that started snapped and tore free
    // mid-drag.
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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable body is
          its own focus stop for keyboard users (WCAG technique G202) */}
      <div className="window-body" tabIndex={0} onScroll={handleBodyScroll}>
        {children}
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
