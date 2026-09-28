// Scrapes `tokens.css` for code that runs outside the browser, which can't evaluate CSS
// custom properties: the WCAG contrast tests and the OG card, since Satori can't read a
// stylesheet.

/** Returns every `--token-name: #rrggbb;` declaration in `source`, keyed without `--`. */
export function parseHexTokens(source: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of source.matchAll(/--([\w-]+):\s*#([0-9a-fA-F]{6});/g)) {
    const [, name, hex] = match;
    if (name && hex) tokens[name] = `#${hex}`;
  }
  return tokens;
}

/** Returns the numeric value of `--<name>: <number>;`; throws if it isn't declared. */
export function parseNumberToken(source: string, name: string): number {
  const match = source.match(new RegExp(`--${name}:\\s*([\\d.]+);`));
  if (!match) throw new Error(`token --${name} not found in tokens.css`);
  return Number(match[1]);
}
