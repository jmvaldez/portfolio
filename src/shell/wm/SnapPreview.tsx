// The dashed outline shown while a drag is armed over a snap zone. `Window.tsx` decides
// which zone is active. `aria-hidden`, since snapping is pointer-only.
import { snapRect, type SnapZone } from './geometry';

interface Props {
  zone: SnapZone;
  desktop: { width: number; height: number };
}

export default function SnapPreview({ zone, desktop }: Props) {
  const rect = snapRect(zone, desktop);
  return (
    <div
      className="snap-preview"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
