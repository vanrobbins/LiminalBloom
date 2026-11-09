// A small top-down shape for each kind in + Add (UX audit U11), drawn the way
// the map draws it, so the choice says roughly what lands on the floor.

import type { AddKind } from "@/lib/layout/session-core";

const SHAPES: Record<AddKind, React.ReactNode> = {
  zone: <rect x="2.5" y="4.5" width="15" height="11" rx="1" strokeDasharray="2.5 2" />,
  entrance: (
    <>
      <path d="M2 15.5h5M13 15.5h5" />
      <path d="M7 15.5a6 6 0 0 1 6-6" strokeDasharray="1.5 1.5" />
    </>
  ),
  table: <rect x="3" y="6" width="14" height="8" rx="0.5" />,
  wall_bay: (
    <>
      <path d="M2 4.5h16" strokeWidth="2" />
      <rect x="4" y="5.5" width="12" height="4" />
    </>
  ),
  rack: (
    <>
      <rect x="4" y="6" width="12" height="8" rx="4" />
      <path d="M6 10h8" />
    </>
  ),
  frame_rack: (
    <>
      <rect x="2" y="7" width="8" height="6" />
      <rect x="10" y="7" width="8" height="6" />
      <path d="M2 10h16" />
    </>
  ),
  mannequin: (
    <>
      <circle cx="10" cy="10" r="4.5" />
      <circle cx="10" cy="10" r="1.25" />
    </>
  ),
  platform: <rect x="3.5" y="3.5" width="13" height="13" rx="2" />,
  prop: (
    <>
      <circle cx="7" cy="12" r="3.5" />
      <rect x="10.5" y="4.5" width="6" height="6" />
    </>
  ),
};

export function KindIcon({ kind }: { kind: AddKind }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5 shrink-0 text-ink-muted">
      {SHAPES[kind]}
    </svg>
  );
}
