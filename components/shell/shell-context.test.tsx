import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ShellProvider, useActiveStoreName, useShell, useShellSheet } from "./shell-context";

function Name() {
  return <p>{useActiveStoreName() ?? "none"}</p>;
}

describe("shell context", () => {
  it("names the active store", () => {
    render(
      <ShellProvider value={{ stores: [{ id: "a", name: "Pioneer Place" }, { id: "b", name: "Washington Square" }], activeStoreId: "b", user: { id: "u", name: "Van", email: "v@x.co" }, switches: ["view"] }}>
        <Name />
      </ShellProvider>,
    );
    expect(screen.getByText("Washington Square")).toBeInTheDocument();
  });

  it("is empty outside the shell", () => {
    render(<Name />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("carries the member's switches for the palette", () => {
    function Switches() {
      return <p>{useShell()?.switches.join(",")}</p>;
    }
    render(
      <ShellProvider value={{ stores: [], activeStoreId: "a", user: { id: "u", name: "Van", email: "v@x.co" }, switches: ["view", "layout.edit"] }}>
        <Switches />
      </ShellProvider>,
    );
    expect(screen.getByText("view,layout.edit")).toBeInTheDocument();
  });

  it("shares the palette sheet between every trigger and the palette itself", async () => {
    function Toggle({ label }: { label: string }) {
      const [open, setOpen] = useShellSheet("palette");
      return <button onClick={() => setOpen(!open)}>{`${label} ${open ? "open" : "closed"}`}</button>;
    }
    render(
      <ShellProvider value={{ stores: [], activeStoreId: "a", user: { id: "u", name: "Van", email: "v@x.co" }, switches: ["view"] }}>
        <Toggle label="header" />
        <Toggle label="palette" />
      </ShellProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "header closed" }));
    expect(screen.getByRole("button", { name: "palette open" })).toBeInTheDocument();
  });
});
