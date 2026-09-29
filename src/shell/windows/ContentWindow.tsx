// A window holding a `file` or `text` node's body: the one-line spec strip, the fetched (or
// inline, for `text`) body, the resume window's download link, and, when the body overflows
// the window, a persistent "read full page" bar linking to the node's page. Breadcrumbs, the
// full spec block, and other page-only content are deliberately left to the page.
import { useEffect, useRef, useState } from 'react';
import { track } from '~/analytics';
import type { FsNode } from '~/fs/types';
import { fetchBody } from '../bodies';
import { handlePromotionClick } from '../promote';
import { useShellStore } from '../store';

type LoadState = { status: 'loading' } | { status: 'loaded'; html: string } | { status: 'error' };

interface Props {
  node: FsNode;
}

export default function ContentWindow({ node }: Props) {
  const isText = node.kind === 'text';
  const [state, setState] = useState<LoadState>(() => ({ status: 'loading' }));
  const wrapRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (isText) return;
    let cancelled = false;
    void fetchBody(node)
      .then((html) => {
        if (!cancelled) setState({ status: 'loaded', html });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [node, isText]);

  // Detects overflow for the "read full page" bar. The wrapper's parent is `Window.tsx`'s
  // scrollable `.window-body`. Both are observed: the wrapper resizes when content loads or
  // reflows, the container when the window resizes, and either can flip the overflow.
  useEffect(() => {
    const el = wrapRef.current;
    const container = el?.parentElement;
    if (!el || !container) return;
    const check = () => setOverflowing(el.scrollHeight > container.clientHeight);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    observer.observe(container);
    return () => observer.disconnect();
  }, [state]);

  const isResume = node.entry?.collection === 'pages' && node.entry.id === 'resume';

  // Restores the saved scroll position once the body is ready. Earlier, the scrollable
  // ancestor hasn't reached its real `scrollHeight`, so the position would clamp to 0.
  // `text` nodes render synchronously and are ready immediately.
  const ready = isText || state.status === 'loaded' || state.status === 'error';
  useEffect(() => {
    if (!ready) return;
    const container = wrapRef.current?.parentElement;
    const pending = useShellStore.getState().consumePendingScroll(node.path);
    if (pending !== undefined && container) container.scrollTo({ top: pending });
  }, [ready, node.path]);

  return (
    <div ref={wrapRef} className="content-window">
      {node.strip && <p className="spec-strip">{node.strip}</p>}
      {isResume && (
        <p className="resume-download">
          <a
            href="/resume.pdf"
            download="joe-valdez-resume.pdf"
            onClick={() => track('resume_pdf_clicked', { source: 'window' })}
          >
            DOWNLOAD PDF
          </a>
        </p>
      )}
      {isText ? (
        <pre className="prose">{node.text}</pre>
      ) : state.status === 'loading' ? (
        <p className="body-loading" aria-hidden="true">
          …
        </p>
      ) : state.status === 'error' ? (
        <p className="body-error">Could not load this file.</p>
      ) : (
        <div className="prose" dangerouslySetInnerHTML={{ __html: state.html }} />
      )}
      {overflowing && node.url && (
        <a
          className="read-full-page"
          href={node.url}
          onClick={(event) => handlePromotionClick(event, node.path)}
        >
          READ FULL PAGE
        </a>
      )}
    </div>
  );
}
