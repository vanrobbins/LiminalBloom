// "Replace with" (0.7.0.9 spec §4.3, §7): a radio group. Keep (the original, with its status) comes first, then the ranked
// suggestions, and Leave empty last. Each choice saves on activation (Space or Enter, or a tap); the arrow keys only move
// focus, as in the status control, so passing over a choice never changes the floor. The chosen one shows a check that
// cross-fades in. Words stay on these radios: they are choices in a list, not actions (R1).

"use client";

import { Check, SquareDashed } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { SuggestionView } from "@/lib/planograms/adjust-reads";

import type { Choice } from "./use-adjustment";

export type Original = { name: string; statusWord: string | null };
/** A replacement already chosen that the suggestions don't list (picked by Search): shown among them so the choice stays visible. */
export type Chosen = { productId: string; name: string; styleNumber: string };

type ReplaceChoicesProps = {
  original: Original;
  /** Null while they load. */
  suggestions: readonly SuggestionView[] | null;
  chosen: Chosen | null;
  current: Choice;
  onChoose: (choice: Choice) => void;
};

type Option = { key: string; choice: Choice; label: string; detail: string | null; empty?: boolean };

const KEYS = new Set(["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"]);

export function ReplaceChoices({ original, suggestions, chosen, current, onChoose }: ReplaceChoicesProps) {
  const heading = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const listed = suggestions ?? [];
  const extra = chosen && !listed.some((s) => s.productId === chosen.productId) ? [chosen] : [];
  const options: Option[] = [
    { key: "keep", choice: { kind: "keep" }, label: `Keep ${original.name}`, detail: original.statusWord },
    ...extra.map((c): Option => ({ key: c.productId, choice: { kind: "replace", productId: c.productId }, label: c.name, detail: c.styleNumber })),
    ...listed.map((s): Option => ({ key: s.productId, choice: { kind: "replace", productId: s.productId }, label: s.name, detail: `${s.reason} · ${s.styleNumber}` })),
    { key: "empty", choice: { kind: "empty" }, label: "Leave empty", detail: null, empty: true },
  ];
  const checkedKey = options.find((o) => o.choice.kind === current.kind && (o.choice.kind !== "replace" || (current.kind === "replace" && o.choice.productId === current.productId)))?.key ?? "keep";
  const tabKey = focusKey && options.some((o) => o.key === focusKey) ? focusKey : checkedKey;

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (!KEYS.has(event.key)) return;
    event.preventDefault();
    const last = options.length - 1;
    const to = event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowDown" || event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : index === 0 ? last : index - 1;
    setFocusKey(options[to].key);
    refs.current[to]?.focus();
  }

  return (
    <section aria-labelledby={heading} className="flex flex-col gap-2">
      <h3 id={heading} className="text-sm font-semibold text-ink">
        Replace with
      </h3>
      <div role="radiogroup" aria-labelledby={heading} className="flex flex-col gap-1">
        {options.map((o, i) => (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={o.key === checkedKey}
            tabIndex={o.key === tabKey ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onFocus={() => setFocusKey(o.key)}
            onClick={() => onChoose(o.choice)}
            className="group flex min-h-11 items-center gap-2 rounded-md border border-line-subtle bg-raised px-3 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-checked:border-ink aria-checked:ring-2 aria-checked:ring-brand"
          >
            {o.empty ? <SquareDashed aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-muted" /> : null}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-ink wrap-break-word">{o.label}</span>
              {o.detail ? <span className="text-sm text-ink-muted">{o.detail}</span> : null}
            </span>
            <Check aria-hidden="true" strokeWidth={2} className="size-5 shrink-0 text-ink opacity-0 group-aria-checked:opacity-100 motion-safe:transition-opacity motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-enter)" />
          </button>
        ))}
      </div>
      {suggestions && listed.length === 0 ? <p className="text-sm text-ink-muted">Nothing in stock fits here.</p> : null}
    </section>
  );
}
