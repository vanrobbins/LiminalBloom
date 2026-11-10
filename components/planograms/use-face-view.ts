// Which face of a planogram is shown, and the slide when it changes: by the
// face switcher, by a sideways swipe, or by Undo landing on another face.

"use client";

import { useState } from "react";

import type { PlanogramScope } from "@/lib/planograms/types";

import { swipeTarget } from "./face-swipe";
import type { Swipe } from "./use-face-swipe";

export function useFaceView(scope: PlanogramScope, firstFace: () => string) {
  const [faceId, setFaceId] = useState(firstFace);
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);
  const face = scope.faces.find((f) => f.faceId === faceId) ?? scope.faces[0];
  const faceIds = scope.faces.map((f) => f.faceId);

  function showFace(id: string, from?: "left" | "right") {
    setSlideFrom(from ?? (faceIds.indexOf(id) > faceIds.indexOf(face.faceId) ? "right" : "left"));
    setFaceId(id);
  }
  function onSwipe(gesture: Swipe) {
    if (scope.isSet) return;
    const target = swipeTarget(faceIds, face.faceId, gesture);
    if (target) showFace(target.faceId, target.from);
  }
  return { face, slideFrom, showFace, onSwipe };
}
