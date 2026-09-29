// The React equivalent of `MaximiseBox.astro`, for a shell window: a link to the node's
// page whose accessible name says where it goes (the glyph is `aria-hidden`). Renders
// nothing for a node without a URL. Hovering prefetches the page, since the shell does its
// own prefetching.
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
      onClick={(event) => handlePromotionClick(event, node.path)}
    >
      <span aria-hidden="true">▢</span>
    </a>
  );
}
