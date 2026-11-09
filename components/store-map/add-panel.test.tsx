import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Focus } from "@/lib/layout/hit-test";
import type { AddKind } from "@/lib/layout/session-core";

import { AddPanel } from "./add-panel";

function Harness({ focus = { kind: "overview" } as Focus, onAdd = () => {}, startOpen = false }: { focus?: Focus; onAdd?: (kind: AddKind) => void; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return <AddPanel focus={focus} onAdd={onAdd} open={open} onOpenChange={setOpen} />;
}

describe("AddPanel", () => {
  it("opens out of + Add, with areas and fixtures grouped", async () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog", { name: "Add to the map" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    const panel = screen.getByRole("dialog", { name: "Add to the map" });
    expect(within(within(panel).getByRole("region", { name: "Areas" })).getByRole("button", { name: "Zone" })).toBeInTheDocument();
    expect(within(within(panel).getByRole("region", { name: "Fixtures" })).getByRole("button", { name: "Rack" })).toBeInTheDocument();
  });

  it("offers zones and entrances only from the whole-store view", () => {
    render(<Harness focus={{ kind: "zone", id: "z" }} startOpen />);
    expect(screen.queryByRole("button", { name: "Zone" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Areas" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rack" })).toBeInTheDocument();
  });

  it("adds the chosen kind and closes", async () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} startOpen />);
    await userEvent.click(screen.getByRole("button", { name: "Wall bay" }));
    expect(onAdd).toHaveBeenCalledWith("wall_bay");
    expect(screen.queryByRole("dialog", { name: "Add to the map" })).toBeNull();
  });

  it("lets a kind be dragged onto the map", () => {
    render(<Harness startOpen />);
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute("draggable", "true");
  });
});
