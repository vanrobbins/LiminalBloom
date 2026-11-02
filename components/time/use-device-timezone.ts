// The device's time zone, which the server can't know. Null while the server
// renders and the page hydrates, so both draw the same thing; the device's
// zone straight after (useSyncExternalStore's server snapshot).

"use client";

import { useSyncExternalStore } from "react";

import { deviceTimezone } from "@/lib/time/format";

const never = () => () => {};

export function useDeviceTimezone(): string | null {
  return useSyncExternalStore(never, deviceTimezone, () => null);
}
