import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShellProvider, useActiveStoreName } from "./shell-context";

function Name() {
  return <p>{useActiveStoreName() ?? "none"}</p>;
}

describe("shell context", () => {
  it("names the active store", () => {
    render(
      <ShellProvider value={{ stores: [{ id: "a", name: "Pioneer Place" }, { id: "b", name: "Washington Square" }], activeStoreId: "b", user: { name: "Van", email: "v@x.co" } }}>
        <Name />
      </ShellProvider>,
    );
    expect(screen.getByText("Washington Square")).toBeInTheDocument();
  });

  it("is empty outside the shell", () => {
    render(<Name />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
