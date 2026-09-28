// The dashed amber outline shown while a drag is armed over a snap zone (ticket 04:
// "A dashed preview of the target shows during the drag"). Purely presentational —
// `Window.tsx` is the only thing that decides *which* zone (or none) is active, via
// `snapTarget`; this component only turns a zone into the rect `snapRect` already
// knows how to compute and renders it. `aria-hidden`: it's a transient pointer-drag
// affordance with nothing keyboard users can trigger it with (ticket 14 § Strategy —
// geometry is pointer-only).
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
