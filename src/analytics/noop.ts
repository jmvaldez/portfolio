// The adapter used when no project key is configured: every call does nothing.
import type { Analytics } from './types';

export const noopAnalytics: Analytics = {
  init: () => Promise.resolve(),
  track: () => undefined,
  page: () => undefined,
};
