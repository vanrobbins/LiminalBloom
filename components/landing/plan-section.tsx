// The scroll's first stop: what a planogram looks like in the app, drawn rather
// than screenshotted. The caption is the drawing's text equivalent.

import { PlanogramDrawing } from "./planogram-drawing";

export function PlanSection() {
  return (
    <section aria-labelledby="plan-title" className="border-t border-line-subtle">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-[2fr_3fr] lg:items-center lg:gap-16">
        <div>
          <h2 id="plan-title" className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Every fixture, drawn to the half foot.
          </h2>
          <p className="mt-4 text-lg text-ink-muted">
            Each table, rack and wall bay has its own planogram on a half-foot grid, so what you see on the screen is
            what goes on the fixture.
          </p>
          <p className="mt-4 text-lg text-ink-muted">
            Tap a product to select it. Drag it to a new spot, pull an edge to give it more room, and undo if you change
            your mind.
          </p>
        </div>
        <figure className="scroll-reveal min-w-0 rounded-lg border border-line-subtle p-4 md:p-6">
          <PlanogramDrawing />
          <figcaption className="mt-4 border-t border-line-subtle pt-4">
            <span className="block font-medium text-ink">
              Linen tee <span className="font-normal text-ink-muted">· Rack 2 · Center · Top rail</span>
            </span>
            <span className="mt-1 block text-sm text-ink-muted">
              A 6 ft rack on a half-foot grid: tees, a sweater, dresses and jackets on the rails, pants and a bag on the
              bottom shelf, and the Linen tee selected.
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
