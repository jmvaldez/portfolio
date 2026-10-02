// The kill-feed toast stack, plus the centred splash for toasts that ask for one.
// Presentational and `aria-hidden`: `store.ts`'s `toast()` already sends the same text to
// the shared status region, so this would double-announce.
import type { Toast } from './store';
import { SPLASH_LIFETIME_MS, useShellStore } from './store';

/** Punches in (scale 1.4 to 1 with a fade, ~200ms), holds, then fades out. Skipped under
 * reduced motion, where the splash just appears and is removed. */
function playSplash(el: HTMLElement | null): void {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate(
    [
      { opacity: 0, transform: 'scale(1.4)' },
      { opacity: 1, transform: 'scale(1)', offset: 200 / SPLASH_LIFETIME_MS },
      { opacity: 1, transform: 'scale(1)', offset: 0.85 },
      { opacity: 0, transform: 'scale(1)' },
    ],
    { duration: SPLASH_LIFETIME_MS, easing: 'ease-out', fill: 'both' },
  );
}

function Splash({ toast }: { toast: Toast }) {
  return (
    <div className="toast-splash" aria-hidden="true" ref={playSplash}>
      <span className="toast-splash-label">{toast.label}</span>
      {toast.value !== undefined && <span className="toast-splash-value">{toast.value}</span>}
    </div>
  );
}

export default function Toasts() {
  const toasts = useShellStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  const feed = toasts.filter((toast) => !toast.splash);
  const splashes = toasts.filter((toast) => toast.splash);

  return (
    <>
      {feed.length > 0 && (
        <ul className="toasts" aria-hidden="true">
          {feed.map((toast) => (
            <li key={toast.id} className="toast frame scan">
              <span className="toast-label">{toast.label}</span>
              {toast.value !== undefined && <span className="toast-value">{toast.value}</span>}
            </li>
          ))}
        </ul>
      )}
      {splashes.map((toast) => (
        <Splash key={toast.id} toast={toast} />
      ))}
    </>
  );
}
