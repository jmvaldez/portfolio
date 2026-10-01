// Opens off-site links in markdown bodies in a new tab, so a visitor following a repo or
// profile link keeps their place in the site. `mailto:` and on-site links are left alone.
// A Sätteri hast plugin (`astro.config.mjs`), typed structurally so this file needs no
// import from the processor.

interface LinkNode {
  properties?: Record<string, unknown>;
}

interface PluginContext {
  setProperty(node: LinkNode, key: string, value: unknown): void;
}

export function isExternalHref(href: unknown): href is string {
  return typeof href === 'string' && /^https?:\/\//i.test(href);
}

export const externalLinksInNewTab = {
  name: 'external-links-in-new-tab',
  element: {
    filter: ['a'],
    visit(node: LinkNode, ctx: PluginContext): void {
      if (!isExternalHref(node.properties?.href)) return;
      ctx.setProperty(node, 'target', '_blank');
      ctx.setProperty(node, 'rel', ['noopener', 'noreferrer']);
    },
  },
};
