// The kill-feed toast stack, plus the centred splash for toasts that ask for one.
// Presentational and `aria-hidden`: `store.ts`'s `toast()` already sends the same text to
// the shared status region, so this would double-announce.
import { useShellStore } from './store';

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
        <div key={toast.id} className="toast-splash" aria-hidden="true">
          <span className="toast-splash-label">{toast.label}</span>
          {toast.value !== undefined && <span className="toast-splash-value">{toast.value}</span>}
        </div>
      ))}
    </>
  );
}
