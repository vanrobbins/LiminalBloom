// A moment in the viewer's own time zone (DECISIONS "Time", 10-12). The server
// can't know the device's zone, so the server render (and hydration) shows UTC,
// marked as such; the device's time replaces it straight after. Same text on
// both sides of hydration, so no mismatch (Review Focus 5).

"use client";

import { inUserTime } from "@/lib/time/format";

import { useDeviceTimezone } from "./use-device-timezone";

export function LocalTime({ at }: { at: Date | string }) {
  const zone = useDeviceTimezone();
  const instant = typeof at === "string" ? new Date(at) : at;
  return <time dateTime={instant.toISOString()}>{zone ? inUserTime(instant, zone) : `${inUserTime(instant, "UTC")} UTC`}</time>;
}
