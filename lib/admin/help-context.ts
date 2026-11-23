// The Context card on an admin's help thread (spec 0.7.1 9.2): what the server wrote about the asker when they
// asked, as label and value lines. Pure. The context is JSON from the database: read defensively, show only
// what is plain text, and show nothing it does not know.

export type ContextLine = { label: string; value: string };

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const named = (v: unknown): string | null => (typeof v === "object" && v !== null ? text((v as { name?: unknown }).name) : null);

export function contextLines(context: Record<string, unknown>): ContextLine[] {
  const lines: ContextLine[] = [];
  const add = (label: string, value: string | null) => value && lines.push({ label, value });
  add("State", text(context.state));
  add("Store", named(context.store));
  add("Role", text(context.role));
  const paused = Array.isArray(context.pausedStores) ? context.pausedStores.map(named).filter((n): n is string => n !== null) : [];
  add("Paused stores", paused.length > 0 ? paused.join(", ") : null);
  add("Asked from", text(context.from));
  return lines;
}
