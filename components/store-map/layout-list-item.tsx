// One row of the list: a button that reveals the item, and its problem if any.

"use client";

type LayoutListItemProps = { label: string; detail?: string; selected: boolean; problem?: string; onReveal: () => void; children?: React.ReactNode };

export function LayoutListItem({ label, detail, selected, problem, onReveal, children }: LayoutListItemProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onReveal}
        className="flex min-h-11 w-full flex-col items-start justify-center rounded px-3 text-left text-sm text-ink aria-pressed:bg-brand aria-pressed:text-on-brand"
      >
        <span>{label}</span>
        {detail ? <span className="text-xs opacity-80">{detail}</span> : null}
      </button>
      {problem ? <p className="px-3 pb-1 text-xs text-danger">{problem}</p> : null}
      {children}
    </li>
  );
}
