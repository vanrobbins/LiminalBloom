// Home: built from what the demo store holds right now. Sold-out products
// still taking space lead to Quick Adjust; drafts lead back to their planogram.

"use client";

import { ArrowRight, Calendar, PencilLine, Search } from "lucide-react";

import { FIXTURES } from "@/lib/demo/seed";
import { notPlaced, productOf, soldOutOnDisplay } from "@/lib/demo/selectors";
import { placeWords } from "@/lib/demo/words";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FOCUS } from "../looks";
import { StatusChip } from "../status-chip";

const ROW = `flex min-h-11 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-line-subtle ${FOCUS}`;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-raised p-3">
      <h3 className="mb-1 px-2 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function HomeScreen() {
  const { state } = useDemoStore();
  const nav = useNav();
  const gaps = soldOutOnDisplay(state);
  const drafts = Object.keys(state.drafts);
  const waiting = notPlaced(state);
  const isLead = state.role === "vm-lead";

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Good morning, Sam</h2>
        <p className="text-sm text-ink-muted">{isLead ? "VM Lead" : "Sales Associate"} · Pioneer Place</p>
      </div>
      <button type="button" onClick={() => nav.go({ name: "products" })} className={`flex min-h-11 items-center gap-2 rounded border border-line bg-raised px-3 text-ink-muted ${FOCUS}`}>
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Find a product
      </button>

      <Card title="Sold out, still on display">
        {gaps.length === 0 ? (
          <p className="px-2 text-sm text-ink-muted">Nothing. Every sold-out product is off the floor.</p>
        ) : (
          gaps.map((gap) => (
            <button key={gap.id} type="button" onClick={() => nav.go({ name: "quick-adjust", placementId: gap.id })} className={ROW}>
              <StatusChip status="sold_out" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{productOf(state, gap.productId).name}</span>
                <span className="block truncate text-xs text-ink-muted">{placeWords(gap)}</span>
              </span>
              <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            </button>
          ))
        )}
      </Card>

      {isLead ? (
        <Card title="Drafts in progress">
          {drafts.length === 0 ? (
            <p className="px-2 text-sm text-ink-muted">None. Move something on a planogram to start one.</p>
          ) : (
            drafts.map((id) => (
              <button key={id} type="button" onClick={() => nav.go({ name: "planogram", fixtureId: id })} className={ROW}>
                <PencilLine aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-muted" />
                <span className="flex-1">{FIXTURES.find((f) => f.id === id)?.name}</span>
                <span className="text-xs text-ink-muted">{state.undo[id]?.length ?? 0} changes</span>
              </button>
            ))
          )}
        </Card>
      ) : null}

      <Card title="Due soon">
        {FIXTURES.map((fixture) => (
          <button key={fixture.id} type="button" onClick={() => nav.go({ name: "planogram", fixtureId: fixture.id })} className={ROW}>
            <Calendar aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-muted" />
            <span className="flex-1">{fixture.name}</span>
            <span className="text-xs text-ink-muted">{fixture.due}</span>
          </button>
        ))}
      </Card>

      <button type="button" onClick={() => nav.go({ name: "products" })} className={`text-left text-sm text-brand-strong underline underline-offset-4 ${FOCUS}`}>
        {waiting.length} products not placed yet
      </button>
    </>
  );
}
