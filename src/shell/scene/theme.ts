// Reads the ticket-06 tokens for the canvas. Read from computed style once per use,
// never hard-coded, so the 3D layer and the CSS chrome cannot drift apart.

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
