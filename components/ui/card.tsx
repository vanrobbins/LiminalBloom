// A raised panel. A border separates it from the page; no shadow, because
// shadows are only for things that float (§5.5).
//
// Padding is chosen by `compact`, not by a caller's class: classes are added,
// never merged, so a p-4 passed in would lose to the p-6 here.

export function Card({
  compact = false,
  className = "",
  ...props
}: React.ComponentProps<"div"> & { compact?: boolean }) {
  const padding = compact ? "p-4" : "p-6";

  return (
    <div
      className={`rounded-lg border border-line-subtle bg-raised ${padding} ${className}`.trim()}
      {...props}
    />
  );
}
