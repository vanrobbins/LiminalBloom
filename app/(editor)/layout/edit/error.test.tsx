import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import EditorError from "./error";

describe("EditorError", () => {
  it("says the editor could not open and offers to try again", async () => {
    const retry = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<EditorError error={new Error("boom")} retry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The layout editor could not be opened.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
    log.mockRestore();
  });
});
