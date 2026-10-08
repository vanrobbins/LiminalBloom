// Where the fixture is in the store (spec §7.3): Week 3's map drawing, fixed on
// the fixture with some floor around it, and the fixture selected.

"use client";

import { useCallback, useState } from "react";

import { StoreMap } from "@/components/store-map/store-map";
import { useElementSize } from "@/components/store-map/use-element-size";
import { fit, worldToScreen, type Viewport } from "@/lib/layout/camera";
import { corners, FIXTURE_RULES } from "@/lib/layout/fixtures";
import { bounds, interiorPoint, type Bounds } from "@/lib/layout/geometry";
import { OVERVIEW } from "@/lib/layout/hit-test";
import type { Fixture, Layout, Point } from "@/lib/layout/types";

// Ten feet of floor around the fixture, so the shopper can recognise the spot.
const CONTEXT = 120;
const LABEL_PX = 13;
// Room kept between a zone name and the frame's edge.
const EDGE = 6;

/**
 * Where a zone's name goes on the mini map, in screen pixels: at its usual
 * spot, but pulled inside both the frame and the visible part of the zone, so
 * it is never cut off at the edge. Null when no whole name fits.
 */
export function zoneLabelSpot(zone: Bounds, anchor: Point, name: string, viewport: Viewport): Point | null {
  // A rough width (0.6 em a letter) is enough to keep the name clear of the edge.
  const halfWidth = (name.length * LABEL_PX * 0.6) / 2;
  const halfHeight = LABEL_PX / 2;
  const left = Math.max(zone.minX, 0) + EDGE + halfWidth;
  const right = Math.min(zone.maxX, viewport.width) - EDGE - halfWidth;
  const top = Math.max(zone.minY, 0) + EDGE + halfHeight;
  const bottom = Math.min(zone.maxY, viewport.height) - EDGE - halfHeight;
  if (left > right || top > bottom) return null;
  return { x: Math.min(Math.max(anchor.x, left), right), y: Math.min(Math.max(anchor.y, top), bottom) };
}

export function LocationMap({ layout, fixtureId }: { layout: Layout; fixtureId: string }) {
  const fixture = layout.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || !layout.outline) return null;
  return <FixtureMap layout={layout} fixture={fixture} />;
}

// Split from LocationMap so the size observer always has its element to watch.
function FixtureMap({ layout, fixture }: { layout: Layout; fixture: Fixture }) {
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const onSize = useCallback((v: Viewport) => setViewport(v), []);
  const ref = useElementSize<HTMLDivElement>(onSize);

  const b = bounds(corners(fixture));
  const area = { minX: b.minX - CONTEXT, minY: b.minY - CONTEXT, maxX: b.maxX + CONTEXT, maxY: b.maxY + CONTEXT };
  const camera = viewport.width > 0 ? fit(area, viewport, 8) : { x: 0, y: 0, scale: 1 };

  // The map draws without its own zone names (they would be cut at the frame);
  // the layer on top draws them where they fit, and the highlight over the fixture.
  const unnamed = { ...layout, zones: layout.zones.map((z) => ({ ...z, name: "" })) };
  const labels = layout.zones.flatMap((z) => {
    if (z.points.length < 3 || !z.name) return [];
    const screen = z.points.map((p) => worldToScreen(camera, p));
    const spot = zoneLabelSpot(bounds(screen), worldToScreen(camera, interiorPoint(z.points)), z.name, viewport);
    const dimmed = fixture.zoneId !== null && z.id !== fixture.zoneId;
    return spot ? [{ id: z.id, name: z.name, spot, dimmed }] : [];
  });
  const f = fixture;

  return (
    <figure className="flex flex-col gap-1">
      <div ref={ref} className="relative h-44 overflow-hidden rounded-md border border-line-subtle bg-surface">
        {viewport.width > 0 ? (
          <>
            <StoreMap
              layout={unnamed}
              camera={camera}
              viewport={viewport}
              focus={fixture.zoneId ? { kind: "zone", id: fixture.zoneId } : OVERVIEW}
              selection={[fixture.id]}
              vertex={null}
              issues={[]}
              guides={[]}
              handles={[]}
              drawing={null}
              drawPreview={null}
              marquee={null}
            />
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
              {labels.map((l) => (
                <text
                  key={l.id}
                  x={l.spot.x}
                  y={l.spot.y}
                  fontSize={LABEL_PX}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--ink)"
                  opacity={l.dimmed ? 0.35 : 1}
                >
                  {l.name}
                </text>
              ))}
              {/* §5.5: gold for the current selection, filled so it shows at a glance on a phone. */}
              <g transform={`scale(${camera.scale}) translate(${-camera.x} ${-camera.y})`}>
                <g transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}>
                  {FIXTURE_RULES[f.type].round ? (
                    <circle data-highlight r={Math.min(f.width, f.depth) / 2} fill="var(--brand)" fillOpacity={0.45} stroke="var(--brand-strong)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                  ) : (
                    <rect data-highlight x={-f.width / 2} y={-f.depth / 2} width={f.width} height={f.depth} rx={2} fill="var(--brand)" fillOpacity={0.45} stroke="var(--brand-strong)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                  )}
                </g>
              </g>
            </svg>
          </>
        ) : null}
      </div>
      <figcaption className="text-sm text-ink-muted">{fixture.name}, highlighted on the store map</figcaption>
    </figure>
  );
}
