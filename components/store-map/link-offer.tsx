// The Link button beside a join (frame racks spec §4.3): six seconds to link
// the racks just dropped near an open end. Nothing links without it.

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { worldToScreen, type Camera, type Viewport } from "@/lib/layout/camera";
import type { RunJoin } from "@/lib/layout/run-join";
import type { SessionAction } from "@/lib/layout/session";

export const LINK_OFFER_MS = 6000;

/** Keeps the button on the map, clear of the edges, whatever the zoom. */
const EDGE = 48;
const clamp = (value: number, size: number) => Math.max(EDGE, Math.min(value, size - EDGE));

type LinkOfferProps = { offer: object; join: RunJoin; camera: Camera; viewport: Viewport; dispatch: (action: SessionAction) => void };

export function LinkOffer({ offer, join, camera, viewport, dispatch }: LinkOfferProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => dispatch({ type: "dropLinkOffer" }), LINK_OFFER_MS);
    return () => window.clearTimeout(timer);
  }, [offer, dispatch]);

  // A phone's panel covers the bottom of the map: the button stays above it.
  const self = useRef<HTMLDivElement>(null);
  const [clearHeight, setClearHeight] = useState(viewport.height);
  useLayoutEffect(() => {
    const panel = document.querySelector("[data-peek-panel]");
    const mapTop = self.current?.offsetParent?.getBoundingClientRect().top ?? 0;
    setClearHeight(panel ? Math.min(viewport.height, panel.getBoundingClientRect().top - mapTop) : viewport.height);
  }, [viewport.height, offer]);

  const at = worldToScreen(camera, join.at);
  return (
    <div ref={self} role="status" className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: clamp(at.x, viewport.width), top: clamp(at.y - EDGE, clearHeight) }}>
      <Button
        onClick={() => {
          dispatch({ type: "command", command: { type: "joinRun", rackId: join.rackId, targetId: join.targetId, side: join.side } });
          dispatch({ type: "dropLinkOffer" });
        }}
      >
        Link
      </Button>
    </div>
  );
}
