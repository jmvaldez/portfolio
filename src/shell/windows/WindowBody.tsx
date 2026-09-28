// Renders a window's body according to its node's kind. Separate from `launch.ts`, which
// decides whether something can be opened at all. An `app` node's component comes from the
// registry, and a `link` node never gets a window.
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
        // `launch()` refuses an unregistered app, so reaching here means a window was
        // opened some other way.
        return <p className="body-error">This app isn&rsquo;t available yet.</p>;
      }
      const App = registration.component;
      // `component` may be a `React.lazy()` value, which needs a `Suspense` boundary above
      // it.
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
