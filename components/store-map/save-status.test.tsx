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
});
