// The "Replace with" radio group (0.7.0.9 spec §4.3, §7): Keep first, Leave empty last, arrows move focus and never save,
// Space and Enter choose, and an empty list says so.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SuggestionView } from "@/lib/planograms/adjust-reads";

import { ReplaceChoices } from "./replace-choices";

const slim: SuggestionView = { productId: "slim", name: "Slim jean", styleNumber: "S-9", colSpan: 2, rowSpan: 2, tier: 1, reason: "Same category and colour" };
const bootcut: SuggestionView = { productId: "boot", name: "Bootcut", styleNumber: "B-1", colSpan: 2, rowSpan: 2, tier: 2, reason: "Same category" };
const original = { name: "Straight jean", statusWord: "Sold out" };

function show(over: Partial<React.ComponentProps<typeof ReplaceChoices>> = {}) {
  const onChoose = vi.fn();
  render(<ReplaceChoices original={original} suggestions={[slim, bootcut]} chosen={null} current={{ kind: "keep" }} onChoose={onChoose} {...over} />);
  return onChoose;
}

describe("ReplaceChoices", () => {
  it("is a labelled radio group: Keep (with its status) first, the suggestions with their tier, Leave empty last", () => {
    show();
    const group = screen.getByRole("radiogroup", { name: "Replace with" });
    const radios = screen.getAllByRole("radio");
    expect(group).toContainElement(radios[0]);
    expect(radios.map((r) => r.textContent)).toEqual(["Keep Straight jeanSold out", "Slim jeanSame category and colour · S-9", "BootcutSame category · B-1", "Leave empty"]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false"]);
  });

  it("the arrow keys move focus and save nothing; Space and Enter choose", async () => {
    const onChoose = show();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("radio", { name: /^Keep/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /^Slim jean/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowRight}");
    expect(onChoose).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /^Leave empty/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /^Keep/ })).toHaveFocus(); // wraps
    await user.keyboard("{End}{ }");
    expect(onChoose).toHaveBeenLastCalledWith({ kind: "empty" });
    await user.keyboard("{Home}{Enter}");
    expect(onChoose).toHaveBeenLastCalledWith({ kind: "keep" });
  });

  it("only the checked radio is a tab stop, so the group is one stop", () => {
    show({ current: { kind: "replace", productId: "boot" } });
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
    expect(screen.getByRole("radio", { name: /^Bootcut/ })).toBeChecked();
  });

  it("a replacement picked by Search that isn't suggested is listed and checked", () => {
    show({ chosen: { productId: "x", name: "Wide leg", styleNumber: "W-2" }, current: { kind: "replace", productId: "x" } });
    expect(screen.getByRole("radio", { name: /^Wide leg/ })).toBeChecked();
  });

  it("says so when nothing fits, and keeps Keep and Leave empty", () => {
    show({ suggestions: [] });
    expect(screen.getByText("Nothing in stock fits here.")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("says nothing about fit while the suggestions load", () => {
    show({ suggestions: null });
    expect(screen.queryByText("Nothing in stock fits here.")).toBeNull();
  });
});
