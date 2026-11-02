// The command palette over a dimmed screen, a name tooltip on an icon
// button, and an ⓘ glossary popover.

import { Command, Plus } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

const GROUPS = [
  { name: "Products", items: ["Linen tee", "Linen shirt"] },
  { name: "Planograms", items: ["Linen story · Window wall"] },
  { name: "Zones", items: ["Linen shop"] },
];

export function PaletteScreen() {
  return (
    <MockScreen tab="none">
      <div className="mt-3 rounded-lg border border-line bg-raised shadow-lg">
        <span className="flex items-center gap-2 border-b border-line px-3 py-2.5 text-sm text-ink">
          lin
          <span className="ml-auto inline-flex items-center gap-0.5 rounded border border-line px-1.5 font-mono text-xs text-ink-muted">
            <Command aria-hidden="true" strokeWidth={1.75} className="size-3" />K
          </span>
          <Marker n={1} />
        </span>
        <div className="flex flex-col gap-1 p-2">
          {GROUPS.map((group, g) => (
            <div key={group.name}>
              <span className="flex items-center justify-between px-2 pt-1 text-xs text-ink-muted">
                {group.name}
                {g === 0 ? <Marker n={2} /> : null}
              </span>
              {group.items.map((item, i) => (
                <span
                  key={item}
                  className={`block rounded px-2 py-1.5 text-sm ${g === 0 && i === 0 ? "bg-brand font-medium text-on-brand" : "text-ink"}`}
                >
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded border border-line bg-raised text-ink">
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </span>
        <span className="rounded bg-ink px-2 py-1 text-xs text-surface">Add product</span>
        <Marker n={3} />
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          Run <span className="rounded-full border border-ink px-1.5 text-xs">i</span>
          <Marker n={4} />
        </span>
        <p className="rounded-lg border border-line bg-raised p-3 text-xs text-ink shadow-lg">
          <span className="mb-1 block font-semibold">Run</span>
          Frame racks linked end to end. You plan the run as one display, and Search still names each rack.
        </p>
      </div>
    </MockScreen>
  );
}
