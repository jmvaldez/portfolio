// The app registry. A node of kind `app` whose `app` field isn't a key here is not
// launchable: `launch.ts` refuses it, and `DesktopIcons.tsx` and `Taskbar.tsx` render no
// icon or launcher for it.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** The app ids a node can declare; kept in sync with `FsNode['app']` in `src/fs/types.ts`. */
export type AppId = 'terminal' | 'viewer';

/** The props an app component receives when its window opens. */
export interface AppProps {
  /** The window's id, which is its node's path (one window per node). */
  windowId: string;
}

export interface AppRegistration {
  component: LazyExoticComponent<ComponentType<AppProps>> | ComponentType<AppProps>;
  singleInstance: true;
}

/** The registered apps. An `AppId` with no entry is unregistered, which `launch.ts` and the
 * icon and launcher renderers check for. */
export const appRegistry: Partial<Record<AppId, AppRegistration>> = {
  terminal: {
    component: lazy(() => import('../terminal/Terminal')),
    singleInstance: true,
  },
  viewer: {
    component: lazy(() => import('./Viewer')),
    singleInstance: true,
  },
};
