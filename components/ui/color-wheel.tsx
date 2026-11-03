// A colour wheel (Week 6.5 spec §4.5), no library: a hue ring around a square
// for lightness (up and down) and chroma (left and right), both worked in
// OKLCH. Drag either with a pointer or finger, or focus it and use the arrow
// keys: 5° of hue on the ring; 5% lightness or 0.01 chroma on the square. A hex
// field underneath takes #rrggbb straight in, and is always there as the way
// in that needs no dragging.

"use client";

import { useState } from "react";

import { hexToOklch, oklchToHex, type Oklch } from "@/lib/products/colors";
import { SWATCH_MESSAGE } from "@/lib/products/schemas";

import { Input } from "./input";

type ColorWheelProps = {
  /** #rrggbb */
  value: string;
  onChange: (hex: string) => void;
  label?: string;
};

const SIZE = 200;
const RING = 18;
const SQUARE = 92;
const MAX_CHROMA = 0.2;
const HUE_NAMES: [number, string][] = [
  [25, "red"], [55, "orange"], [95, "yellow"], [145, "green"], [195, "teal"], [255, "blue"], [305, "purple"], [350, "pink"],
];

export function hueName(h: number): string {
  const distance = (a: number) => Math.min(Math.abs(a - h), 360 - Math.abs(a - h));
  return HUE_NAMES.reduce((best, next) => (distance(next[0]) < distance(best[0]) ? next : best))[1];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number, step: number) => Math.round(n / step) * step;

export function ColorWheel({ value, onChange, label = "Color" }: ColorWheelProps) {
  // Kept in OKLCH while dragging, so a grey (no hue in hex) keeps the hue you picked.
  const [color, setColor] = useState<Oklch>(() => hexToOklch(value));
  const [typed, setTyped] = useState(value);
  const [typedError, setTypedError] = useState<string | undefined>();
  const hex = oklchToHex(color);

  function set(next: Oklch) {
    const c = { l: clamp(next.l, 0, 1), c: clamp(next.c, 0, MAX_CHROMA), h: ((next.h % 360) + 360) % 360 };
    setColor(c);
    const out = oklchToHex(c);
    setTyped(out);
    setTypedError(undefined);
    onChange(out);
  }

  function fromRing(event: React.PointerEvent<SVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    set({ ...color, h: (Math.atan2(y, x) * 180) / Math.PI + 90 });
  }

  function fromSquare(event: React.PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    set({ ...color, c: ((event.clientX - box.left) / box.width) * MAX_CHROMA, l: 1 - (event.clientY - box.top) / box.height });
  }

  const drag = <E extends Element>(move: (e: React.PointerEvent<E>) => void) => ({
    onPointerDown: (e: React.PointerEvent<E>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      move(e);
    },
    onPointerMove: (e: React.PointerEvent<E>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
    },
  });

  function ringKeys(event: React.KeyboardEvent) {
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 30, PageDown: -30 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    set({ ...color, h: round(color.h, 5) + step });
  }

  function squareKeys(event: React.KeyboardEvent) {
    const change: Partial<Record<string, Partial<Oklch>>> = {
      ArrowUp: { l: round(color.l, 0.05) + 0.05 },
      ArrowDown: { l: round(color.l, 0.05) - 0.05 },
      ArrowRight: { c: round(color.c, 0.01) + 0.01 },
      ArrowLeft: { c: round(color.c, 0.01) - 0.01 },
    };
    const next = change[event.key];
    if (!next) return;
    event.preventDefault();
    set({ ...color, ...next });
  }

  function type(text: string) {
    setTyped(text);
    const clean = text.trim().toLowerCase();
    const withHash = clean.startsWith("#") ? clean : `#${clean}`;
    if (/^#[0-9a-f]{6}$/.test(withHash)) {
      setColor(hexToOklch(withHash));
      setTypedError(undefined);
      onChange(withHash);
    } else {
      setTypedError(SWATCH_MESSAGE);
    }
  }

  const angle = ((color.h - 90) * Math.PI) / 180;
  const r = SIZE / 2 - RING / 2;
  const hueStops = Array.from({ length: 13 }, (_, i) => oklchToHex({ l: 0.7, c: 0.12, h: i * 30 }));
  const hueText = `Hue ${Math.round(color.h)}°, ${hueName(color.h)}`;
  const squareText = `Lightness ${Math.round(color.l * 100)}%, chroma ${color.c.toFixed(2)}`;

  return (
    <div role="group" aria-label={label} className="flex flex-col items-start gap-3">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          role="slider"
          tabIndex={0}
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(color.h)}
          aria-valuetext={hueText}
          onKeyDown={ringKeys}
          {...drag<SVGSVGElement>(fromRing)}
          className="touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          style={{ background: `conic-gradient(${hueStops.join(", ")})`, mask: `radial-gradient(circle, transparent ${SIZE / 2 - RING}px, black ${SIZE / 2 - RING}px)` }}
        >
          <title>{hueText}</title>
        </svg>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-4 -translate-1/2 rounded-full border-2 border-raised shadow ring-1 ring-ink"
          style={{ left: SIZE / 2 + r * Math.cos(angle), top: SIZE / 2 + r * Math.sin(angle), background: oklchToHex({ l: 0.7, c: 0.12, h: color.h }) }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Lightness and chroma"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(color.l * 100)}
          aria-valuetext={squareText}
          onKeyDown={squareKeys}
          {...drag<HTMLDivElement>(fromSquare)}
          className="absolute touch-none rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          style={{
            left: (SIZE - SQUARE) / 2,
            top: (SIZE - SQUARE) / 2,
            width: SQUARE,
            height: SQUARE,
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, ${oklchToHex({ l: 0.7, c: 0, h: color.h })}, ${oklchToHex({ l: 0.7, c: MAX_CHROMA, h: color.h })})`,
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-4 -translate-1/2 rounded-full border-2 border-raised ring-1 ring-ink"
            style={{ left: `${(color.c / MAX_CHROMA) * 100}%`, top: `${(1 - color.l) * 100}%`, background: hex }}
          />
        </div>
      </div>
      <Input label="Hex" name="hex" value={typed} onChange={(event) => type(event.target.value)} error={typedError} autoComplete="off" spellCheck={false} />
    </div>
  );
}
