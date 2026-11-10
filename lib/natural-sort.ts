// Names in the order people expect: "Rack 2" before "Rack 10", case ignored
// (UX audit U3). Lists sort with this; the map keeps creation order for drawing.

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

export function byName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareNames(a.name, b.name));
}

/** The type label under a name, unless the name already says it ("Rack 7" is a Rack) (UX audit U10). */
export function typeHint(name: string, typeLabel: string): string | undefined {
  return name.toLowerCase().includes(typeLabel.toLowerCase()) ? undefined : typeLabel;
}
