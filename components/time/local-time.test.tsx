import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/format", async (original) => ({
  ...(await original<typeof import("@/lib/time/format")>()),
  deviceTimezone: () => "Pacific/Honolulu",
}));

import { LocalTime } from "./local-time";

const at = new Date("2026-10-13T03:00:00Z");

describe("LocalTime", () => {
  it("shows the moment in the device's zone once on the client", () => {
    render(<LocalTime at={at} />);
    expect(screen.getByText("Oct 12, 5:00 PM")).toHaveAttribute("dateTime", "2026-10-13T03:00:00.000Z");
  });

  it("renders the same text on the server whatever the device, so hydration never mismatches (Review Focus 5)", () => {
    expect(renderToString(<LocalTime at={at} />)).toContain("Oct 13, 3:00 AM UTC");
  });
});
