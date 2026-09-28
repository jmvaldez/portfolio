// The React equivalent of `MaximiseBox.astro`, for a shell window (glossary
// "Promotion"; ticket 09; ticket 14 § The maximise and close boxes: the accessible
// name says where it goes, and the glyph itself is `aria-hidden`). `Window.tsx`
// renders this into its `maximiseSlot` iff `node.url` is set — "a window has a
// maximise box iff its node has a URL" is enforced by the caller (`Desktop.tsx`)
// never passing this component a node without one, not by a check in here, but the
// early return covers it either way.
//
// Hovering it prefetches the destination page (ticket 09 § Prefetch, D4: the shell
// does its own hover prefetch since content pages carry no JS of their own to
// prefetch with).
import type { FsNode } from '~/fs/types';
import { handlePromotionClick } from '../promote';

function prefetchPage(href: string): void {
  if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

interface Props {
  node: FsNode;
}

export default function MaximiseBox({ node }: Props) {
  const { url } = node;
  if (!url) return null;

  return (
    <a
      className="ctl maxbox"
      href={url}
      aria-label={`Open ${node.title} page`}
      onMouseEnter={() => prefetchPage(url)}
      onFocus={() => prefetchPage(url)}
      onClick={handlePromotionClick}
    >
      <span aria-hidden="true">▢</span>
    </a>
  );
}
