import { act, render, renderHook, screen } from "@testing-library/react";
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
});
