// The kill-feed toast stack (ticket 06 § the FPS layer's concrete form: "kill-feed
// toasts top-right"; Task 10.4). Purely presentational and `aria-hidden` — the same
// text already reaches the shared `role="status"` region via `store.ts`'s own
// `toast()` (ticket 14 § Terminal: "toasts ... all go through one shared role=status
// region"), so this stack would otherwise double-announce every toast.
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
