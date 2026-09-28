/**
 * The one breakpoint: viewport size only, re-evaluated live. The head gate and the
 * island's `matchMedia` share it; `HeadGate.astro` interpolates it into its inline script
 * because that script can't import.
 */
export const SHELL_QUERY = '(min-width: 1024px) and (min-height: 600px)';
