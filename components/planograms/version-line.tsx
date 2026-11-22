// "Version 4 · published Oct 8, 3:05 PM by Van" (device time), or "Not published".
// `versionText` is the same words as a string, for a tooltip.

"use client";

import { useEffect, useRef } from "react";

import { takeVersionFocus } from "@/components/quick-adjust/focus-version";
import { LocalTime } from "@/components/time/local-time";
import { useDeviceTimezone } from "@/components/time/use-device-timezone";
import { inUserTime } from "@/lib/time/format";
import type { PublishedVersion } from "@/lib/planograms/queries";

type Latest = Pick<PublishedVersion, "number" | "publishedAt" | "publishedByName">;

function versionText(latest: Latest, zone: string | null): string {
  return `Version ${latest.number} · published ${zone ? inUserTime(latest.publishedAt, zone) : `${inUserTime(latest.publishedAt, "UTC")} UTC`} by ${latest.publishedByName}`;
}

/** The version line as a string in the device's time zone. */
export function useVersionText(latest: Latest): string {
  return versionText(latest, useDeviceTimezone());
}

export function VersionLine({ latest }: { latest: Latest | null }) {
  const line = useRef<HTMLParagraphElement>(null);
  // Landing here after publishing a Quick Adjust: focus is on this line (focus-version.ts).
  useEffect(() => {
    if (takeVersionFocus()) line.current?.focus();
  }, []);
  return (
    <p ref={line} tabIndex={-1} data-version-line className="text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
      {latest ? (
        <>
          Version {latest.number} · published <LocalTime at={latest.publishedAt} /> by {latest.publishedByName}
        </>
      ) : (
        "Not published"
      )}
    </p>
  );
}
