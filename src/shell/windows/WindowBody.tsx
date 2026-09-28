// Dispatches a window's body content by node kind (ticket 05 § "the window holds the
// full body... a directory opens a folder window... one component, but it is a
// second window type"). Kept separate from `launch.ts`: that module decides whether
// something can be opened at all, this one decides how the open window's body
// renders — a `dir`/`file`/`text` node always reaches here once its window exists,
// but an `app` node's actual component comes from the registry, and a `link` node
// never gets a window in the first place (`launch.ts` never opens one).
import { Suspense } from 'react';
import type { FsNode } from '~/fs/types';
import { appRegistry } from '../apps/registry';
import ContentWindow from './ContentWindow';
import FolderWindow from './FolderWindow';

interface Props {
  node: FsNode | undefined;
  windowId: string;
}

export default function WindowBody({ node, windowId }: Props) {
  if (!node) {
    return <p className="body-error">This node no longer exists.</p>;
  }

  switch (node.kind) {
    case 'dir':
      return <FolderWindow node={node} />;
    case 'file':
    case 'text':
      return <ContentWindow node={node} />;
    case 'app': {
      const registration = node.app !== undefined ? appRegistry[node.app] : undefined;
      if (!registration) {
        // `launch()` refuses an unregistered app before a window like this one could
        // even open — reaching here means a window was opened some other way. Phase
        // 11/12 register `terminal`/`viewer`; nothing does yet.
        return <p className="body-error">This app isn&rsquo;t available yet.</p>;
      }
      const App = registration.component;
      // `component` may be a `React.lazy()` value (`AppRegistration`'s own type),
      // which requires a `Suspense` boundary somewhere above it or an unmounted
      // dynamic import throws instead of suspending quietly.
      return (
        <Suspense
          fallback={
            <p className="body-loading" aria-hidden="true">
              …
            </p>
          }
        >
          <App windowId={windowId} />
        </Suspense>
      );
    }
    case 'link':
      // `launch()` never opens a window for a `link` node — unreachable in practice.
      return null;
  }
}
