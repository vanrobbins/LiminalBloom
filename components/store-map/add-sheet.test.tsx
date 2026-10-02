import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddSheet } from "./add-sheet";

describe("AddSheet", () => {
  it("offers zones and entrances only from the whole-store view", () => {
    const { rerender } = render(<AddSheet open onOpenChange={() => {}} focus={{ kind: "overview" }} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: "Zone" })).toBeInTheDocument();
    rerender(<AddSheet open onOpenChange={() => {}} focus={{ kind: "zone", id: "z" }} onAdd={() => {}} />);
    expect(screen.queryByRole("button", { name: "Zone" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rack" })).toBeInTheDocument();
  });

  it("adds the chosen type and closes", async () => {
    const onAdd = vi.fn();
    const onOpenChange = vi.fn();
    render(<AddSheet open onOpenChange={onOpenChange} focus={{ kind: "overview" }} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Wall bay" }));
    expect(onAdd).toHaveBeenCalledWith("wall_bay");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
