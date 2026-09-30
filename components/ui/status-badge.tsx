// A product's status as a small pill: icon, word, and tone color. The word is
// always there, so the status reads without color (§5.5).

import {
  PRODUCT_STATUS,
  type ProductStatus,
  type StatusTone,
} from "@/lib/product-status";

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: "bg-ok-tint text-ok",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const { label, icon: Icon, tone } = PRODUCT_STATUS[status];

  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${TONE_CLASSES[tone]}`}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {label}
    </span>
  );
}
