// Shared `tokens.css` scraper (ticket 06 § Tokens). CSS custom properties are not
// values Node can evaluate, so anything outside the browser that needs a token's actual
// value — `src/styles/contrast.test.ts`'s WCAG checks, and Task 7.2's OG card, which has
// to paint the same palette Satori cannot read from a stylesheet — scrapes it out of the
// same file with the same two regexes, rather than each keeping its own copy.

/** Every `--token-name: #rrggbb;` declaration in `source`, keyed without the `--`. */
export function parseHexTokens(source: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of source.matchAll(/--([\w-]+):\s*#([0-9a-fA-F]{6});/g)) {
    const [, name, hex] = match;
    if (name && hex) tokens[name] = `#${hex}`;
  }
  return tokens;
}

/** The bare numeric value of a `--token-name: <number>;` declaration (e.g. `--scan-alpha`). */
export function parseNumberToken(source: string, name: string): number {
  const match = source.match(new RegExp(`--${name}:\\s*([\\d.]+);`));
  if (!match) throw new Error(`token --${name} not found in tokens.css`);
  return Number(match[1]);
}
