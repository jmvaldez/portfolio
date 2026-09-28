// The app registry (ticket 05 § Terminal and desktop surfaces, D16). Phase 11
// registers `terminal` below; Phase 12 registers `viewer`. A node of kind `app`
// whose `app` field isn't a key here is not launchable at all: `launch.ts` refuses
// it, and neither `DesktopIcons.tsx` nor `Taskbar.tsx` renders an icon/launcher for
// it in the first place (ticket 14: an unregistered app isn't just disabled, it
// isn't rendered).
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Kept in sync with `FsNode['app']` (`src/fs/types.ts`) — the two `app`-kind nodes
 * the mount table can ever declare. */
export type AppId = 'terminal' | 'viewer';

/** What an app component receives when its window opens. Deliberately minimal —
 * nothing consumes it yet. `windowId` (the node's own path, per `store.ts`'s
 * single-instance-per-node rule) is the obvious first thing a real app needs, e.g.
 * the terminal reading its own working directory back out of the store, or
 * `viewer.exe` telling the shared canvas which view to draw. */
export interface AppProps {
  windowId: string;
}

export interface AppRegistration {
  component: LazyExoticComponent<ComponentType<AppProps>> | ComponentType<AppProps>;
  singleInstance: true;
}

/** `Partial` on purpose: an `AppId` with no entry here is exactly "not registered
 * yet", which is what `launch.ts` and the icon/launcher renderers check for. */
export const appRegistry: Partial<Record<AppId, AppRegistration>> = {
  terminal: {
    component: lazy(() => import('../terminal/Terminal')),
    singleInstance: true,
  },
};
