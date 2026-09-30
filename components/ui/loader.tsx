// Placeholder for the bloom loader (§3.12.4). The animated bloom needs
// Motion, which is not approved until Week 7; the label, which names the
// work, is the part that matters and stays.

export function Loader({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16">
      <span
        aria-hidden="true"
        className="size-8 animate-pulse rounded-full bg-brand motion-reduce:animate-none"
      />
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}
