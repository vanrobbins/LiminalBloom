// The status row shows only what applies (0.7.0.5 task 10): the Draft | Published
// toggle only once something was published, the due date only once set.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/planograms/actions", () => ({ setDueDateAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { PublishedVersion } from "@/lib/planograms/queries";

import { StatusRow } from "./status-row";

const latest: PublishedVersion = { number: 4, publishedAt: new Date("2026-10-08T15:05:00Z"), publishedByName: "Van", summary: null, placements: [] };
type Props = React.ComponentProps<typeof StatusRow>;
const show = (over: Partial<Props> = {}) =>
  render(
    <StatusRow fixtureId="fx" latest={latest} hasDraft view="draft" onView={vi.fn()} dueDate={null} today="2026-10-10" canSetDueDate status={null} {...over}>
      {null}
    </StatusRow>,
  );

describe("StatusRow", () => {
  it("never published: no toggle and no info button, just a quiet \"Draft · not published\"", () => {
    show({ latest: null });
    expect(screen.getByText("Draft · not published")).toHaveClass("text-sm", "text-ink-muted");
    expect(screen.queryByRole("group", { name: "Show" })).toBeNull();
    expect(screen.queryByRole("button", { name: /What.s draft/ })).toBeNull();
    expect(screen.queryByText(/^Not published$/)).toBeNull();
  });

  it("published at least once, with a draft: the toggle shows and the version isn't repeated beside it", () => {
    show();
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/Version 4/)).toBeNull();
    expect(screen.queryByRole("button", { name: /What.s draft/ })).toBeNull();
  });

  it("the toggle's tooltip explains drafts and carries the version line", async () => {
    show();
    await userEvent.hover(screen.getByRole("group", { name: "Show" }));
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Publishing makes the draft the version everyone sees.");
    expect(tip).toHaveTextContent(/Version 4 · published .* by Van/);
  });

  it("published with no draft: the version line, no toggle", () => {
    show({ hasDraft: false, view: "published" });
    expect(screen.getByText(/Version 4 · published/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Show" })).toBeNull();
  });

  it("the due date is a chip only when set, and a tap opens the editor", async () => {
    const { unmount } = show();
    expect(screen.queryByRole("button", { name: /due/i })).toBeNull();
    unmount();
    show({ dueDate: "2026-10-14" });
    await userEvent.click(screen.getByRole("button", { name: "Due Oct 14" }));
    expect(screen.getByRole("dialog", { name: "Change due date" })).toBeInTheDocument();
  });

  it("an overdue date keeps its warning style", () => {
    show({ dueDate: "2026-10-01" });
    expect(screen.getByRole("button", { name: /^Overdue/ })).toHaveAttribute("data-overdue");
  });
});
