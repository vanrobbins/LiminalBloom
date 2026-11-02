import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TimezonePicker } from "./timezone-picker";

describe("TimezonePicker", () => {
  it("starts on the given zone, US zones first", () => {
    render(<TimezonePicker name="timezone" defaultZone="America/Chicago" />);
    const select = screen.getByLabelText("Time zone");
    expect(select).toHaveValue("America/Chicago");
    expect(screen.getAllByRole("group")[0]).toHaveAttribute("label", "United States");
  });

  it("narrows the list as you type, keeping the chosen zone", async () => {
    render(<TimezonePicker name="timezone" defaultZone="America/Chicago" />);
    await userEvent.type(screen.getByLabelText("Find a time zone"), "london");
    expect(screen.getByRole("option", { name: "Europe/London" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Pacific (America/Los Angeles)" })).toBeNull();
    expect(screen.getByLabelText("Time zone")).toHaveValue("America/Chicago");
  });
});
