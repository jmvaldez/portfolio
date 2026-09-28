// A window holding a `file` or `text` node's body (ticket 05 § "the window holds the
// full body"; ticket 12 § Window versus page). Carries the one-line spec strip
// (`node.strip`) under the title bar, the fetched (or inline, for `text`) body, the
// resume window's `DOWNLOAD PDF` link (ticket 15), and — when the body overflows the
// window — the persistent `READ FULL PAGE` bar to the node's page (ticket 09).
//
// What this component does NOT carry, on purpose (ticket 12 § "the page alone
// carries"): breadcrumbs, the full spec block, cover, gallery, footage, children
// listing, prev/next. Those are the page's job.
import { useEffect, useRef, useState } from 'react';
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

  // Overflow detection for the `READ FULL PAGE` bar (ticket 12: "a body taller than
  // its window shows a persistent amber READ FULL PAGE bar"). `wrapRef`'s own parent
  // is `Window.tsx`'s `.window-body` — the scrollable container with the fixed
  // content-area height — so both elements are watched: the wrapper's box changes
  // when content loads or reflows, the container's box changes when the window is
  // resized, and either can flip whether the content overflows.
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

  // Restores this window's saved scroll position (Task 10.3, ticket 09 § State
  // across the round trip) once its body is actually ready — before then, the
  // scrollable ancestor (`Window.tsx`'s `.window-body`) hasn't grown to its real
  // `scrollHeight` yet, so setting `scrollTop` any earlier would just clamp to 0.
  // `text` nodes render their content synchronously, so `isText` counts as ready
  // immediately.
  const ready = isText || state.status === 'loaded' || state.status === 'error';
  useEffect(() => {
    if (!ready) return;
    const container = wrapRef.current?.parentElement;
    const pending = useShellStore.getState().consumePendingScroll(node.path);
    if (pending !== undefined && container) container.scrollTo({ top: pending });
  }, [ready, node.path]);

  return (
    <div ref={wrapRef}>
      {node.strip && <p className="spec-strip">{node.strip}</p>}
      {isResume && (
        <p className="resume-download">
          <a href="/resume.pdf" download="joe-valdez-resume.pdf">
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
        <a className="read-full-page" href={node.url} onClick={handlePromotionClick}>
          READ FULL PAGE
        </a>
      )}
    </div>
  );
}
