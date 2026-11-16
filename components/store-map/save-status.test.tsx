import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SaveStatus } from "./save-status";

describe("SaveStatus", () => {
  it.each([
    ["saved", "Saved"],
    ["saving", "Saving…"],
    ["offline", "Offline, retrying"],
  ] as const)("announces %s politely", (status, text) => {
    render(<SaveStatus status={status} />);
    expect(screen.getByRole("status")).toHaveTextContent(text);
  });

  it("a refusal replaces the label, in the danger colour, with an alert icon", () => {
    render(<SaveStatus status="saved" refusal="Table 2 was changed on another device." />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Table 2 was changed on another device.");
    expect(status).not.toHaveTextContent("Saved");
    expect(status).toHaveClass("text-danger");
    expect(status.querySelector("svg")).not.toBeNull();
  });

  it("is quiet with no refusal", () => {
    render(<SaveStatus status="saved" refusal={null} />);
    expect(screen.getByRole("status")).not.toHaveClass("text-danger");
  });
});
