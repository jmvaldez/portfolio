// The desktop surface (ticket 14 § Shell structure, § Round 2; map Hazards: the skip
// link and the opaque-surface trap). Phase 9/10 grow `#desktop` into the window
// manager, the desktop icons and the taskbar; this phase ships the empty surface, its
// heading and the skip link ahead of it.
//
// The shared `role="status"` region lives in `Shell.tsx`, not here, even though the
// phase doc lists it under `Desktop`: narrowing past the breakpoint unmounts this
// component in the same tick it announces "Switched to text layout" (ticket 14
// § Live swap), and a status region that's removed before a screen reader observes
// the mutation never gets read out. `Shell.tsx` always exists (it's the island root),
// so hosting the region there is the only way that announcement survives.
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { setLayoutOverride } from '~/lib/storage';

export interface DesktopHandle {
  /** Focuses the desktop's own h1 — the widen fallback (ticket 14 § Live swap:
   * "else the desktop h1") when there's no counterpart window yet to focus. Phase
   * 9/10 should extend `Shell.tsx`'s caller to check the actually-focused window's
   * root mount first, and fall back to this only when none is open. */
  focusHeading: () => void;
}

interface Props {
  /** Called when the skip link is activated: `Shell.tsx` stops rendering `Desktop`
   * from then on. `Desktop` itself only sets the override and drops the `shell`
   * class; it never decides whether it keeps rendering. */
  onSkip: () => void;
}

const Desktop = forwardRef<DesktopHandle, Props>(function Desktop({ onSkip }, ref) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useImperativeHandle(ref, () => ({
    focusHeading: () => headingRef.current?.focus(),
  }));

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
      <div id="desktop" />
    </>
  );
});

export default Desktop;
