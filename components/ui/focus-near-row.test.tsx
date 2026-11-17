import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { focusNearRow } from "./focus-near-row";

function list(rows: Array<{ name: string; button?: boolean; inert?: boolean }>) {
  render(
    <>
      <h1>Page</h1>
      <section>
        <h2>List</h2>
        <ul>
          {rows.map((r) => (
            <li key={r.name} inert={r.inert}>
              {r.name}
              {r.button === false ? null : <button>{r.name} button</button>}
            </li>
          ))}
        </ul>
      </section>
    </>,
  );
  const row = (name: string) => screen.getByText(name, { exact: false, selector: "li" });
  return { row, heading: screen.getByRole("heading", { name: "List" }) };
}

describe("focusNearRow", () => {
  it("goes to the next row's control", () => {
    const { row, heading } = list([{ name: "a" }, { name: "b" }, { name: "c" }]);
    focusNearRow(row("b"), heading);
    expect(screen.getByRole("button", { name: "c button" })).toHaveFocus();
  });

  it("goes to the previous row's control when there is no next one", () => {
    const { row, heading } = list([{ name: "a" }, { name: "b" }]);
    focusNearRow(row("b"), heading);
    expect(screen.getByRole("button", { name: "a button" })).toHaveFocus();
  });

  it("passes over rows with nothing to focus and rows already folding shut", () => {
    const { row, heading } = list([{ name: "a" }, { name: "b" }, { name: "c", button: false }, { name: "d", inert: true }, { name: "e" }]);
    focusNearRow(row("b"), heading);
    expect(screen.getByRole("button", { name: "e button" })).toHaveFocus();
  });

  it("goes to the list's heading when other rows are left but none has a control", () => {
    const { row, heading } = list([{ name: "a", button: false }, { name: "b" }]);
    focusNearRow(row("b"), heading);
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("goes to the page title when the row is the list's last (the heading goes with it)", () => {
    const { row, heading } = list([{ name: "a" }]);
    focusNearRow(row("a"), heading);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });
});
