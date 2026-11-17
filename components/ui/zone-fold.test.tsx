import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useOpenGroups } from "./use-open-groups";
import { ZoneFold } from "./zone-fold";

function Groups({ selected = null }: { selected?: string | null }) {
  const { isOpen, toggle, canFold } = useOpenGroups({ storeKey: "s1", groupIds: ["a", "b"], selectedGroupId: selected });
  return (
    <>
      {["a", "b"].map((id) => (
        <ZoneFold key={id} title={`Zone ${id}`} count={1} open={isOpen(id)} canFold={canFold} onToggle={() => toggle(id)}>
          <p>Inside {id}</p>
        </ZoneFold>
      ))}
    </>
  );
}

describe("ZoneFold and useOpenGroups", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts folded; the header is a button that opens it", async () => {
    render(<Groups />);
    const header = screen.getByRole("button", { name: /Zone a/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inside a")).toBeNull();
    await userEvent.setup().click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Inside a")).toBeInTheDocument();
  });

  it("remembers what was opened on this device, per store", async () => {
    const { unmount } = render(<Groups />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Zone b/ }));
    unmount();
    render(<Groups />);
    expect(screen.getByText("Inside b")).toBeInTheDocument();
    expect(screen.queryByText("Inside a")).toBeNull();
    const other = renderHook(() => useOpenGroups({ storeKey: "s2", groupIds: ["a", "b"] }));
    expect(other.result.current.isOpen("b")).toBe(false);
  });

  it("opens the group holding the selection by itself", () => {
    const { rerender } = render(<Groups />);
    expect(screen.queryByText("Inside a")).toBeNull();
    rerender(<Groups selected="a" />);
    expect(screen.getByText("Inside a")).toBeInTheDocument();
  });

  it("keeps a lone group open with no arrow", () => {
    const { result } = renderHook(() => useOpenGroups({ storeKey: "s1", groupIds: ["only"] }));
    expect(result.current.isOpen("only")).toBe(true);
    expect(result.current.canFold).toBe(false);
    act(() => result.current.toggle("only"));
    expect(result.current.isOpen("only")).toBe(true);
  });

  it("a lone top-level group stays open while a group nested in it still folds", () => {
    const { result } = renderHook(() => useOpenGroups({ storeKey: "s1", groupIds: ["only"], selectedGroupId: ["only", "run"] }));
    expect(result.current.isOpen("only")).toBe(true);
    expect(result.current.isOpen("run")).toBe(true);
    act(() => result.current.toggle("run"));
    expect(result.current.isOpen("run")).toBe(false);
    act(() => result.current.toggle("only"));
    expect(result.current.isOpen("only")).toBe(true);
  });

  it("a selected row highlights as one: the chevron and the heading sit inside the selected row", () => {
    render(
      <ZoneFold title="Zone a" count={1} open={false} onToggle={() => {}} onSelect={() => {}} selected>
        <p>x</p>
      </ZoneFold>,
    );
    const chevron = screen.getByRole("button", { name: "Show Zone a" });
    const row = chevron.closest("[data-selected]");
    expect(row).toHaveAttribute("data-selected", "true");
    expect(row).toContainElement(screen.getByRole("heading", { name: /^Zone a/ }));
  });

  it("the heading holds only the select button; the chevron keeps one name and aria-expanded carries the state", async () => {
    const { rerender } = render(
      <ZoneFold title="Zone c" count={2} open={false} onToggle={() => {}} onSelect={() => {}} as="h3">
        <p>x</p>
      </ZoneFold>,
    );
    const heading = screen.getByRole("heading", { level: 3, name: /^Zone c/ });
    expect(within(heading).getAllByRole("button")).toHaveLength(1);
    expect(within(heading).getByRole("button")).toHaveAttribute("aria-pressed");
    const chevron = screen.getByRole("button", { name: "Show Zone c" });
    expect(heading).not.toContainElement(chevron);
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    rerender(
      <ZoneFold title="Zone c" count={2} open onToggle={() => {}} onSelect={() => {}} as="h3">
        <p>x</p>
      </ZoneFold>,
    );
    expect(screen.getByRole("button", { name: "Show Zone c" })).toHaveAttribute("aria-expanded", "true");
  });
});
