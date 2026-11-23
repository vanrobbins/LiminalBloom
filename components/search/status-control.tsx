// In stock / Sold out / On sale, saved the moment it is tapped (spec §7.3). The
// chosen radio shows a check that cross-fades in over its icon; there is no toast,
// and choosing the previous status again is the undo (0.7.0.5 spec §3.1). A refusal
// shows under the radios; a lost connection stays a toast.

"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { changeStatus } from "@/app/(app)/products/status-actions";
import { InfoPopover } from "@/components/ui/info-popover";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Holder } from "@/lib/access/can";
import { allowedStatuses } from "@/lib/access/rank";
import { PRODUCT_STATUS, type ProductStatus } from "@/lib/product-status";
import type { ProductRow } from "@/lib/products/queries";
import { PRODUCT_STATUSES } from "@/lib/products/schemas";
import { toast } from "@/lib/toast";

const FADE = "motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-[var(--ease-enter)]";

type StatusControlProps = {
  product: ProductRow;
  member: Holder;
  onChanged: (product: ProductRow) => void;
  /** How many floor locations the product has (bins are not displays); a sold-out one still on display is said aloud (0.7.0.9). */
  displays?: number;
};

export function StatusControl({ product, member, onChanged, displays = 0 }: StatusControlProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [problem, setProblem] = useState("");
  // Only the current status and the changes this person's switches allow (rank.ts); the server checks the same rule.
  const switches = new Set(member.switches);
  const choices = PRODUCT_STATUSES.filter((s) => s === product.status || allowedStatuses(product.status, switches).includes(s));

  async function save(from: ProductRow, status: ProductStatus) {
    setIsSaving(true);
    setProblem("");
    try {
      const result = await changeStatus(from.id, from.version, status);
      if (result.status === "saved") return onChanged({ ...from, status, version: result.version });
      if (result.status === "forbidden") return setProblem("Your role can't make that change. The status was not changed.");
      if (result.product) onChanged(result.product);
      setProblem("Changed on another device. The current status is shown.");
    } catch {
      toast({ tone: "error", title: "Couldn't save the status", description: "Check your connection and try again." });
    } finally {
      setIsSaving(false);
    }
  }

  async function choose(status: ProductStatus) {
    if (status === product.status || isSaving) return;
    await save(product, status);
  }

  // Arrows move focus only; Space or Enter chooses. Every choice saves at once,
  // so arrowing must not save three times on the way (DECISIONS, plan D5).
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const at = radios.indexOf(document.activeElement as HTMLButtonElement);
    radios[(at + step + radios.length) % radios.length]?.focus();
  }

  // A refusal first; else a sold-out product that is still on a display, which is what Quick Adjust fixes.
  const line = problem || (product.status === "sold_out" && displays > 0 ? `Sold out. On ${displays} ${displays === 1 ? "display" : "displays"}.` : "");

  // Nothing to choose: show the status, not a control that does nothing.
  if (choices.length === 1) return <StatusBadge status={product.status} />;

  return (
    <div>
      <div className="flex items-center gap-1">
        <div role="radiogroup" aria-label="Status" onKeyDown={onKeyDown} className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1 rounded-lg border border-line-subtle bg-surface p-1">
          {choices.map((status) => {
            const { label, icon: Icon } = PRODUCT_STATUS[status];
            const isChecked = product.status === status;
            return (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={isChecked}
                tabIndex={isChecked ? 0 : -1}
                // Not `disabled`: that would drop keyboard focus mid-save. choose() ignores taps meanwhile.
                aria-disabled={isSaving}
                onClick={() => void choose(status)}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${isChecked ? "bg-raised font-semibold text-ink shadow-sm" : "text-ink-muted"}`}
              >
                {/* The check fades in over the status icon: one slot, two icons swapping opacity (300 ms). */}
                <span className="relative size-4 shrink-0">
                  <Icon aria-hidden="true" strokeWidth={1.75} className={`absolute inset-0 size-4 ${FADE} ${isChecked ? "opacity-0" : "opacity-100"}`} />
                  <Check data-check aria-hidden="true" strokeWidth={2} className={`absolute inset-0 size-4 ${FADE} ${isChecked ? "opacity-100" : "opacity-0"}`} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
        <InfoPopover term="status" />
      </div>
      {/* Always in the page, so a refusal (or the sold-out line) that arrives is announced. */}
      <p role="status" aria-live="polite" className={problem ? "mt-1 text-sm text-danger" : line ? "mt-1 text-sm text-ink-muted" : "sr-only"}>
        {line}
      </p>
    </div>
  );
}
