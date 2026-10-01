import { describe, expect, it } from 'vitest';
import { externalLinksInNewTab, isExternalHref } from './external-links';

function visit(href: string): Record<string, unknown> {
  const node = { properties: { href } as Record<string, unknown> };
  externalLinksInNewTab.element.visit(node, {
    setProperty: (n, key, value) => {
      n.properties = { ...n.properties, [key]: value };
    },
  });
  return node.properties;
}

describe('externalLinksInNewTab', () => {
  it('opens http(s) links in a new tab without an opener', () => {
    expect(visit('https://github.com/jmvaldez')).toEqual({
      href: 'https://github.com/jmvaldez',
      target: '_blank',
      rel: ['noopener', 'noreferrer'],
    });
  });

  it('leaves mailto and on-site links alone', () => {
    expect(visit('mailto:someone@example.com')).toEqual({ href: 'mailto:someone@example.com' });
    expect(visit('/projects/aetherforge/roadmap/')).toEqual({
      href: '/projects/aetherforge/roadmap/',
    });
  });
});

describe('isExternalHref', () => {
  it('is true only for absolute http(s) URLs', () => {
    expect(isExternalHref('https://www.linkedin.com/in/joseph-m-valdez/')).toBe(true);
    expect(isExternalHref('/resume.pdf')).toBe(false);
    expect(isExternalHref(undefined)).toBe(false);
  });
});
