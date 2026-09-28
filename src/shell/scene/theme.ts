/** Returns the trimmed computed value of the CSS custom property `name` on `<html>`, so the
 * canvas and the CSS chrome share one set of tokens. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
