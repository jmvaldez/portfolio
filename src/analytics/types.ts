// The provider-agnostic analytics contract. Shell code sees only this file and the facade in
// `index.ts`; nothing here (or in any caller) knows which vendor sits behind it.

/**
 * Every event the site emits, mapped to its props. The one catalogue: adding an event means
 * adding a line here, so a call site can't invent a name or a prop shape. Names are
 * snake_case and vendor-neutral; an adapter maps them onto its own conventions.
 */
export interface AnalyticsEvents {
  /** A visitor opened a window (icon, launcher, folder row or terminal `open`). A window
   * restored from the saved layout is not an open. */
  window_opened: { path: string; kind: 'dir' | 'file' | 'text' | 'app' };
  /** A window's maximise box or "read full page" bar took the visitor to its page. */
  window_promoted: { path: string };
  /** A terminal line ran. `command` is the command's name only, never its arguments; a name
   * that isn't a command is `unknown`. */
  terminal_command_run: { command: string };
  /** The desktop shell became ready: after a first-visit boot, a one-line restore, or a
   * live widen past the breakpoint. */
  shell_entered: { mode: 'boot' | 'restore' | 'widen' };
  /** The visitor is on the linear layout instead of the desktop: it was never shown, the
   * skip link was used, or the viewport narrowed past the breakpoint. */
  linear_handoff: { reason: 'initial' | 'skip_link' | 'narrowed' };
  /** How the 3D scene resolved, once per page load: the WebGL canvas came up, or the SVG
   * and CSS fallback took over (no WebGL, reduced motion, or a canvas that failed). */
  scene_resolved: { scene: 'webgl' | 'svg_fallback' };
  /** The resume PDF was downloaded from a window or by launching it (terminal `open`). */
  resume_pdf_clicked: { source: 'window' | 'launch' };
}

export type EventName = keyof AnalyticsEvents;

export interface Analytics {
  /** Starts the provider. Resolves once `track` and `page` are live. */
  init(): Promise<void>;
  track<E extends EventName>(event: E, props: AnalyticsEvents[E]): void;
  /** Records a page view for the current location. */
  page(): void;
}
