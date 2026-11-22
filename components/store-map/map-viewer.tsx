// The read-only map (spec §10): pan, zoom, tap a zone to open it, tap a
// fixture for its details and its published planogram. It runs the same session as the editor in
// read-only mode, so both behave alike and nothing here can change the layout.
// Everything on the map is listed beside it on desktop and in a sheet below
// that (UX audit U7); on a phone the map runs edge to edge (U8). Edit and
// + Add sit in the page's title row (LayoutScreen). There is no hint row: a
// zone's name shares one row with Whole store (and List, when narrow); with no
// zone open, List floats over the map's corner so the map gets the height.

"use client";

import { ArrowLeft, List } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OVERVIEW, hitTest } from "@/lib/layout/hit-test";
import { createReducer } from "@/lib/layout/session";
import { createSession } from "@/lib/layout/session-core";
import { withoutParam } from "@/lib/url-params";
import type { Layout } from "@/lib/layout/types";
import type { FloorPlanogram, ProductLook } from "@/lib/planograms/types";

import { FixturePanel } from "./fixture-panel";
import { LayoutList } from "./layout-list";
import { StoreMap } from "./store-map";
import { useElementSize } from "./use-element-size";
import { PHONE_QUERY, useMediaQuery } from "./use-media-query";
import { usePointerInput } from "./use-pointer-input";
import { ZoomControls } from "./zoom-controls";

type MapViewerProps = {
  layout: Layout;
  planograms: Readonly<Record<string, FloorPlanogram>>;
  looks: Readonly<Record<string, ProductLook>>;
  /** Keys the list's remembered open zones (A1). */
  storeKey: string;
  /** /layout?zone=: open focused on this zone if the map has it, else the whole store (the palette's Zone result). */
  initialZone?: string;
};

const WIDE_QUERY = "(min-width: 1024px)";

export function MapViewer({ layout, planograms, looks, storeKey, initialZone }: MapViewerProps) {
  // The viewer never makes new items, so its ids are never used.
  const reduce = useMemo(() => createReducer(() => crypto.randomUUID()), []);
  const [session, dispatch] = useReducer(reduce, layout, (initial) => {
    const start = createSession(initial, true);
    return initialZone && initial.zones.some((z) => z.id === initialZone) ? { ...start, focus: { kind: "zone" as const, id: initialZone } } : start;
  });
  // The param only opens the map: drop it so a refresh, or Whole store, behaves as it always did.
  useEffect(() => {
    const clean = withoutParam(window.location.pathname + window.location.search + window.location.hash, "zone");
    if (clean !== null) window.history.replaceState(null, "", clean);
  }, []);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isWide = useMediaQuery(WIDE_QUERY);
  const [listOpen, setListOpen] = useState(false);
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

  const list = (
    <LayoutList
      layout={session.layout}
      selection={session.selection}
      issues={[]}
      storeKey={storeKey}
      dispatch={(action) => {
        dispatch(action);
        if (action.type === "reveal") setListOpen(false);
      }}
    />
  );

  const listButton = (
    <Button icon variant="secondary" className="shrink-0" onClick={() => setListOpen(true)} aria-label="List">
      <List aria-hidden="true" strokeWidth={1.75} className="size-5" />
    </Button>
  );
  const empty = session.layout.zones.length === 0 && session.layout.fixtures.length === 0;
  // The map and list fill the screen under the page title; the zone row, when there is one, is 44 px plus its gap (3.5rem).
  const height = focusedZone ? "h-[calc(100dvh-13rem)] md:h-[calc(100dvh-14rem)]" : "h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-10.5rem)]";

  return (
    <div className="flex flex-col gap-3">
      {focusedZone ? (
        <div className="flex min-h-11 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button icon variant="secondary" className="shrink-0" onClick={() => dispatch({ type: "focus", focus: OVERVIEW })} aria-label="Whole store">
              <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Button>
            <h2 className="min-w-0 truncate text-lg font-semibold text-ink">{focusedZone.name}</h2>
          </div>
          {isWide ? null : listButton}
        </div>
      ) : null}
      <div className="flex gap-4">
        {isWide ? <aside className={`${height} w-64 shrink-0 overflow-y-auto border-r border-line-subtle`}>{list}</aside> : null}
        <div
          ref={container}
          className={`relative ${height} min-w-0 flex-1 overflow-hidden bg-surface max-md:-mx-4 md:rounded-lg md:border md:border-line-subtle`}
        >
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
          {empty ? <p className="pointer-events-none absolute inset-x-0 top-16 z-10 px-4 text-center text-sm text-ink-muted">Nothing on the map yet.</p> : null}
          {!isWide && !focusedZone ? <div className="absolute top-3 left-4 z-10 md:left-3">{listButton}</div> : null}
          <ZoomControls onZoom={(factor) => dispatch({ type: "zoom", factor })} onFit={() => dispatch({ type: "fit" })} />
          {selectedFixture && !isPhone ? (
            <Card compact className="absolute top-3 right-3 flex max-h-[calc(100%-1.5rem)] w-96 flex-col overflow-y-auto md:right-16 lg:right-3">
              <h3 className="mb-2 font-semibold text-ink">{selectedFixture.name}</h3>
              <FixturePanel layout={session.layout} fixtureId={selectedFixture.id} planograms={planograms} looks={looks} />
            </Card>
          ) : null}
        </div>
      </div>
      {isWide ? null : (
        <BottomSheet open={listOpen} onOpenChange={setListOpen} title="Everything on the map">
          {list}
        </BottomSheet>
      )}
      {isPhone ? (
        <BottomSheet
          open={selectedFixture !== undefined}
          onOpenChange={(open) => {
            if (!open) dispatch({ type: "select", ids: [] });
          }}
          title={selectedFixture?.name ?? "Fixture"}
          tall
        >
          {selectedFixture ? <FixturePanel layout={session.layout} fixtureId={selectedFixture.id} planograms={planograms} looks={looks} /> : null}
        </BottomSheet>
      ) : null}
    </div>
  );
}
