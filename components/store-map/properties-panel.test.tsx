import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createSession } from "@/lib/layout/session-core";
import { face, fixture, store, zone } from "@/lib/layout/test-layouts";
import type { Layout } from "@/lib/layout/types";

import { PropertiesPanel } from "./properties-panel";

function panel(layout: Layout, selection: string[]) {
  const dispatch = vi.fn();
  render(<PropertiesPanel session={{ ...createSession(layout, false), selection }} dispatch={dispatch} />);
  return dispatch;
}

describe("PropertiesPanel", () => {
  it("renames a zone", async () => {
    const dispatch = panel({ ...store(), zones: [zone()] }, ["zone-a"]);
    const name = screen.getByRole("textbox", { name: "Zone name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Windows{Enter}");
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "updateZone", id: "zone-a", changes: { name: "Windows" } } });
  });

  it("asks before deleting a zone, saying its fixtures stay", async () => {
    const dispatch = panel({ ...store(), zones: [zone()], fixtures: [fixture({ x: 100, y: 100, zoneId: "zone-a" })] }, ["zone-a"]);
    await userEvent.click(screen.getByRole("button", { name: "Delete zone" }));
    expect(screen.getByRole("dialog", { name: "Delete Front tables?" })).toHaveAccessibleDescription("Its 1 fixture stays on the map.");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "delete", ids: ["zone-a"] } });
  });

  it("switches a rack's display sides on and off, keeping at least one", async () => {
    const rack = fixture({ type: "rack", name: "Rack 1", width: 48, depth: 24 });
    const dispatch = panel({ ...store(), fixtures: [rack], faces: [face({ side: "front", columns: 4 })] }, ["fixture-a"]);
    expect(screen.getByRole("button", { name: "Front" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "setFace", fixtureId: "fixture-a", side: "back", on: true } });
  });

  it("adds a lower table to a table's side", async () => {
    const dispatch = panel({ ...store(), fixtures: [fixture()], faces: [face()] }, ["fixture-a"]);
    await userEvent.click(screen.getByRole("button", { name: "Lower table on the left" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "attachLowerTable", upperId: "fixture-a", side: "left" } });
  });

  it("changes a grid with the steppers", async () => {
    const dispatch = panel({ ...store(), fixtures: [fixture()], faces: [face()] }, ["fixture-a"]);
    await userEvent.click(screen.getByRole("button", { name: "More columns" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "setFaceGrid", faceId: "face-a", columns: 7, rows: 3 } });
  });

  it("offers group actions for several items", () => {
    panel({ ...store(), fixtures: [fixture(), fixture({ id: "b", name: "Table 2", x: 400 })] }, ["fixture-a", "b"]);
    expect(screen.getByText("2 items selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
  });
});
