import type { Status } from "@/lib/demo/types";

import { STATUS_LOOK } from "./looks";

export function StatusChip({ status }: { status: Status }) {
  const { word, icon: Icon, tone } = STATUS_LOOK[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3" />
      {word}
    </span>
  );
}
