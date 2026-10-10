import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryList } from "./history-list";

const actions = vi.hoisted(() => ({ restoreAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const entries = [
  { number: 2, publishedAt: new Date("2026-10-08T12:00:00Z"), publishedByName: "Van", summary: "October denim reset", changeText: "Front: 1 moved", gone: [{ label: "Back", count: 3 }] },
  { number: 1, publishedAt: new Date("2026-10-01T12:00:00Z"), publishedByName: "Van", summary: null, changeText: "Front: 4 added", gone: [] },
];

describe("HistoryList", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists versions newest first with their changes", () => {
    render(<HistoryList fixtureId="fx" expectedVersion={9} entries={entries} />);
    const items = screen.getAllByRole("article");
    expect(within(items[0]).getByRole("heading")).toHaveTextContent("Version 2");
    expect(items[0]).toHaveTextContent("Oct 8 · Van");
    expect(items[0]).toHaveTextContent("October denim reset");
    expect(items[0]).toHaveTextContent("Front: 1 moved");
    expect(items[0]).toHaveTextContent("Back is no longer on this fixture (3 products).");
    expect(within(items[1]).getByRole("link", { name: "View version 1" })).toHaveAttribute("href", "/planograms/fx?version=1");
  });

  it("restores after a confirmation and opens the draft", async () => {
    actions.restoreAction.mockResolvedValue({ status: "saved", message: "Restored version 1 as a draft." });
    render(<HistoryList fixtureId="fx" expectedVersion={9} entries={entries} />);
    await userEvent.click(screen.getByRole("button", { name: "Restore version 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Restore as draft" }));
    expect(actions.restoreAction).toHaveBeenCalledWith("fx", 9, 1);
    expect(push).toHaveBeenCalledWith("/planograms/fx");
  });
});
