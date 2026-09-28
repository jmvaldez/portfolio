import { beforeEach, describe, expect, it } from 'vitest';
import { useShellStore } from './store';

// The store is a module-level singleton, so snapshot its initial state and reset to it
// before each test.
const INITIAL_STATE = useShellStore.getState();

beforeEach(() => {
  useShellStore.setState(INITIAL_STATE, true);
});

describe('toast', () => {
  it('caps visible toasts at 4, dropping the oldest rather than queuing', () => {
    const { toast } = useShellStore.getState();
    toast('a');
    toast('b');
    toast('c');
    toast('d');
    toast('e');

    const labels = useShellStore.getState().toasts.map((t) => t.label);
    expect(labels).toHaveLength(4);
    expect(labels).toEqual(['b', 'c', 'd', 'e']);
  });

  it('keeps the newest toast at the end of the stack', () => {
    const { toast } = useShellStore.getState();
    toast('a');
    toast('b');
    toast('c');

    const toasts = useShellStore.getState().toasts;
    expect(toasts[toasts.length - 1]?.label).toBe('c');
  });

  it('sends the same text to the shared status region', () => {
    useShellStore.getState().toast('TINT', 'AMBER');
    expect(useShellStore.getState().lastAnnouncement).toBe('TINT: AMBER');
  });

  it('carries a value-less toast through to the status region by label alone', () => {
    useShellStore.getState().toast('ARMED');
    expect(useShellStore.getState().lastAnnouncement).toBe('ARMED');
  });

  it('dismissToast removes a toast by id', () => {
    useShellStore.getState().toast('a');
    const id = useShellStore.getState().toasts[0]!.id;

    useShellStore.getState().dismissToast(id);

    expect(useShellStore.getState().toasts).toHaveLength(0);
  });
});
