// What the app does today, in a store team's words. Only shipped features are
// listed; planned ones sit in the clearly labelled "Coming later" line.

type Feature = { title: string; body: React.ReactNode };

export const FEATURES: Feature[] = [
  {
    title: "A map of your store",
    body: "Draw the floor once: tables, racks and wall bays, grouped into zones. Everyone sees the same layout.",
  },
  {
    title: "A product library with photos",
    body: "Every product with its photo, style number and category, and whether it is hung or folded.",
  },
  {
    title: "Search that tells you where",
    body: (
      <>
        Type a name or a style number and get the spot in plain words, like{" "}
        <span className="font-medium whitespace-nowrap text-ink">Table 1 · Center · Middle</span>, with the fixture
        marked on the map.
      </>
    ),
  },
  {
    title: "A planogram for each fixture",
    body: "Work on a draft, publish it when it is ready, and look back through the history to bring an older version back.",
  },
  {
    title: "A builder made for touch",
    body: "Tap to select, drag to move, pull an edge to resize, and undo any step. It works with a mouse or a keyboard too.",
  },
  {
    title: "More than one store",
    body: "Belong to several stores and switch between them in one tap. Each store's data stays separate.",
  },
];

export function FeatureList() {
  return (
    <section aria-labelledby="features-title" className="border-t border-line-subtle">
      <div className="scroll-reveal mx-auto w-full max-w-5xl px-6 py-16 md:px-10 md:py-24">
        <h2 id="features-title" className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          What it does today
        </h2>
        <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="border-t border-line pt-5">
              <h3 className="text-lg font-semibold text-ink">{feature.title}</h3>
              <p className="mt-2 text-ink-muted">{feature.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 max-w-2xl text-ink-muted">
          <span className="font-medium text-ink">Coming later:</span> roles and permissions, Quick Adjust for when a
          product sells out, and VM scheduling.
        </p>
      </div>
    </section>
  );
}
