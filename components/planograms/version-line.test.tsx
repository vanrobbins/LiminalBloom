// The version line takes focus once, when a Quick Adjust has just been published (0.7.0.9 spec §7), and never otherwise.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { wantVersionFocus } from "@/components/quick-adjust/focus-version";

import { VersionLine } from "./version-line";

const latest = { number: 3, publishedAt: new Date("2026-11-09T12:00:00Z"), publishedByName: "Van" };

describe("VersionLine", () => {
  it("is not focused on an ordinary visit", () => {
    render(<VersionLine latest={latest} />);
    expect(screen.getByText(/^Version 3/)).not.toHaveFocus();
  });

  it("takes focus after a Quick Adjust was published, and only the first one mounted gets it", () => {
    wantVersionFocus();
    const { unmount } = render(<VersionLine latest={latest} />);
    expect(screen.getByText(/^Version 3/)).toHaveFocus();
    unmount();
    render(<VersionLine latest={latest} />);
    expect(screen.getByText(/^Version 3/)).not.toHaveFocus();
  });
});
