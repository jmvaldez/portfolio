// Catches a canvas that could not be built at all (context creation refused, GPU
// blocklisted): the gate says yes but the machine says no. Marks the scene failed so the
// fallback (CSS grid floor, drone SVG) takes over, and the `VEC` gauge reads standby.
import { Component, type ReactNode } from 'react';
import { markSceneFailed } from './gate';
import { useShellStore } from '../store';

interface Props {
  children: ReactNode;
}

export default class SceneBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    useShellStore.getState().setEffects({ vector: 'standby' });
    markSceneFailed();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
