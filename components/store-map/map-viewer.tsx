// The read-only map (spec §10): pan, zoom, tap a zone to open it, tap a
// fixture for its details. It runs the same session as the editor in
// read-only mode, so both behave alike and nothing here can change the layout.

"use client";

import { useCallback, useMemo, useReducer } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OVERVIEW, hitTest } from "@/lib/layout/hit-test";
import { createReducer } from "@/lib/layout/session";
import { createSession } from "@/lib/layout/session-core";
import type { Layout } from "@/lib/layout/types";

import { FixtureDetails } from "./fixture-details";
import { StoreMap } from "./store-map";
import { useElementSize } from "./use-element-size";
import { PHONE_QUERY, useMediaQuery } from "./use-media-query";
import { usePointerInput } from "./use-pointer-input";
import { ZoomControls } from "./zoom-controls";

export function MapViewer({ layout }: { layout: Layout }) {
  // The viewer never makes new items, so its ids are never used.
  const reduce = useMemo(() => createReducer(() => crypto.randomUUID()), []);
  const [session, dispatch] = useReducer(reduce, layout, (initial) => createSession(initial, true));
  const isPhone = useMediaQuery(PHONE_QUERY);
  const onSize = useCallback((viewport: { width: number; height: number }) => dispatch({ type: "viewport", viewport }), []);
  const container = useElementSize<HTMLDivElement>(onSize);

  const pointer = usePointerInput({
    hit: (screen) => hitTest(session.layout, session.focus, session.camera, screen, [], false),
    canDrag: () => false,
    onEffect: (effect) => dispatch({ type: "gesture", effect }),
    onWheel: ({ screen, dx, dy, zoom }) =>
      dispatch(zoom ? { type: "zoom", factor: Math.exp(-dy * 0.01), at: screen } : { type: "pan", dx: -dx, dy: -dy }),
  });

  const focus = session.focus;
  const focusedZone = focus.kind === "zone" ? session.layout.zones.find((z) => z.id === focus.id) : undefined;
  const selected = session.selection[0];
  const selectedFixture = session.layout.fixtures.find((f) => f.id === selected);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {focusedZone ? (
          <Button variant="secondary" onClick={() => dispatch({ type: "focus", focus: OVERVIEW })}>
            ← Whole store
          </Button>
        ) : (
          <p className="text-sm text-ink-muted">Tap a zone to look inside it.</p>
        )}
        <Button asChild>
          <a href="/layout/edit">Edit layout</a>
        </Button>
      </div>
      {focusedZone ? <h2 className="text-lg font-semibold text-ink">{focusedZone.name}</h2> : null}
      <div ref={container} className="relative h-[65dvh] overflow-hidden rounded-lg border border-line-subtle bg-surface md:h-[calc(100dvh-14rem)]">
        <StoreMap
          layout={session.layout}
          camera={session.camera}
          viewport={session.viewport}
          focus={session.focus}
          selection={session.selection}
          vertex={null}
          issues={[]}
          guides={[]}
          handles={[]}
          drawing={null}
          drawPreview={null}
          marquee={null}
          svgProps={pointer.handlers}
        />
        <ZoomControls onZoom={(factor) => dispatch({ type: "zoom", factor })} onFit={() => dispatch({ type: "fit" })} />
        {selectedFixture && !isPhone ? (
          <Card compact className="absolute bottom-3 left-3 w-72">
            <h3 className="mb-2 font-semibold text-ink">{selectedFixture.name}</h3>
            <FixtureDetails layout={session.layout} fixtureId={selectedFixture.id} />
          </Card>
        ) : null}
      </div>
      {isPhone ? (
        <BottomSheet
          open={selectedFixture !== undefined}
          onOpenChange={(open) => {
            if (!open) dispatch({ type: "select", ids: [] });
          }}
          title={selectedFixture?.name ?? "Fixture"}
        >
          {selectedFixture ? <FixtureDetails layout={session.layout} fixtureId={selectedFixture.id} /> : null}
        </BottomSheet>
      ) : null}
    </div>
  );
}
