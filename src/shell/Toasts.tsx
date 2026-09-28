// The kill-feed toast stack. Presentational and `aria-hidden`: `store.ts`'s `toast()`
// already sends the same text to the shared status region, so this would double-announce.
import { useShellStore } from './store';

export default function Toasts() {
  const toasts = useShellStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <ul className="toasts" aria-hidden="true">
      {toasts.map((toast) => (
        <li key={toast.id} className="toast frame scan">
          <span className="toast-label">{toast.label}</span>
          {toast.value !== undefined && <span className="toast-value">{toast.value}</span>}
        </li>
      ))}
    </ul>
  );
}
