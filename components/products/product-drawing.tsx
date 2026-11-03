// A product drawn as it really sits (Week 6.5 spec §4): its shape in the view
// asked for, filled with its swatch or colour word, its texture laid over the
// body, details in the darker tone, and a thin ink outline so any fill shows
// in both themes. Without a colour it is neutral: line-coloured body, muted
// details.

"use client";

import { useId } from "react";

import { css, detailOf, tintFor } from "@/lib/products/colors";
import { DRAWINGS, type Shape, type View } from "@/lib/products/drawings";
import type { Texture } from "@/lib/products/schemas";

type ProductDrawingProps = {
  shape: Shape;
  view: View;
  swatch?: string | null;
  colorWord?: string | null;
  texture?: Texture;
  className?: string;
  /** Names the drawing for screen readers; omit when the control around it already does. */
  label?: string;
};

/** One small tile of each pattern, in user units of the 100 × 120 box. */
function Pattern({ id, texture, color }: { id: string; texture: Exclude<Texture, "solid">; color: string }) {
  const line = { stroke: color, strokeWidth: 1.5, opacity: 0.35 } as const;
  switch (texture) {
    case "stripes":
      return (
        <pattern id={id} width={10} height={10} patternUnits="userSpaceOnUse">
          <rect width={10} height={4} fill={color} opacity={0.35} />
        </pattern>
      );
    case "check":
      return (
        <pattern id={id} width={12} height={12} patternUnits="userSpaceOnUse">
          <rect width={12} height={4} fill={color} opacity={0.3} />
          <rect width={4} height={12} fill={color} opacity={0.3} />
        </pattern>
      );
    case "dots":
      return (
        <pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse">
          <circle cx={4} cy={4} r={1.4} fill={color} opacity={0.4} />
        </pattern>
      );
    case "denim":
      return (
        <pattern id={id} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={4} {...line} strokeWidth={1} />
        </pattern>
      );
    case "rib":
      return (
        <pattern id={id} width={4} height={10} patternUnits="userSpaceOnUse">
          <line x1={2} y1={0} x2={2} y2={10} {...line} strokeWidth={1} />
        </pattern>
      );
  }
}

export function ProductDrawing({ shape, view, swatch, colorWord, texture = "solid", className = "", label }: ProductDrawingProps) {
  // Two drawings on one page must never share a <pattern> or <clipPath>.
  const id = useId().replace(/:/g, "");
  const { body, details } = DRAWINGS[shape][view];
  const tint = tintFor(swatch, colorWord);
  const fill = tint ? css(tint) : "var(--line)";
  const detail = tint ? css(detailOf(tint)) : "var(--ink-muted)";
  const patternId = `${id}-texture`;
  const clipId = `${id}-clip`;
  return (
    <svg
      viewBox="0 0 100 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-drawing={shape}
      data-view={view}
      data-texture={texture}
      data-fill={fill}
      className={className}
    >
      {texture !== "solid" ? (
        <defs>
          <Pattern id={patternId} texture={texture} color={detail} />
          <clipPath id={clipId}>
            <path d={body} fillRule="evenodd" />
          </clipPath>
        </defs>
      ) : null}
      <path d={body} fill={fill} fillRule="evenodd" />
      {texture !== "solid" ? <rect width={100} height={120} fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} /> : null}
      <path d={details} fill="none" stroke={detail} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={body} fill="none" fillRule="evenodd" className="stroke-ink-muted" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
