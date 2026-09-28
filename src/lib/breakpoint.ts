// The one breakpoint (ticket 11 § Breakpoint, D13): size only, no capability clause,
// re-evaluated live and shared verbatim by the head gate and the island's own
// `matchMedia` (ticket 10 § Knock-on effects: "the head script" must test it "before
// any JS module loads"). This is the only place the media-query string is written
// literally — `HeadGate.astro` interpolates it into its inline script from here, and
// Phase 9's island imports it directly.
export const SHELL_QUERY = '(min-width: 1024px) and (min-height: 600px)';
