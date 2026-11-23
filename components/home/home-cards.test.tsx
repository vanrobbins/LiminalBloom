import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeData } from "@/lib/home/types";

const mocks = vi.hoisted(() => ({ data: {} as HomeData, shown: [] as string[], switches: [] as string[] }));

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/current-member", () => ({ requireMember: async () => ({ id: "m", switches: mocks.switches }) }));
vi.mock("@/lib/home/load", () => ({ loadHome: async () => mocks.data }));
vi.mock("@/lib/home/cards", () => ({ shownCards: () => mocks.shown }));

import { HomeCards } from "./home-cards";

beforeEach(() => {
  mocks.data = {};
  mocks.shown = [];
  mocks.switches = [];
});

describe("HomeCards", () => {
  it("says so in one calm line when no card has anything to show", async () => {
    render(await HomeCards());
    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
  });

  it("does not show the calm line when a card is shown", async () => {
    mocks.shown = ["published"];
    render(await HomeCards());
    expect(screen.queryByText("Nothing needs you right now.")).toBeNull();
  });

  it("renders each shown card from its slice of the data, in the order given", async () => {
    mocks.data = {
      planograms: { rows: [{ fixtureId: "f1", name: "Front", typeLabel: "Rack", publishedVersion: null, publishedAt: null, hasDraft: true, dueDate: null, overdue: false }], total: 1, today: "2026-11-16" },
      notPlaced: { products: 2, fixtures: 0 },
      published: [{ fixtureId: "f1", fixtureName: "Front", version: 1, publisherName: "Ana", publishedAt: new Date("2026-11-15T18:00:00Z") }],
    };
    mocks.shown = ["planograms", "notPlaced", "published"];
    render(await HomeCards());
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Planograms to finish", "Not placed yet", "Recently published"]);
  });

  it("a Quick Adjust draft row opens the adjust page for a drafter and the planogram for a publisher who can't draft", async () => {
    const adjusting = { fixtureId: "f1", name: "Front", typeLabel: "Rack", publishedVersion: 2, publishedAt: null, hasDraft: false, dueDate: null, overdue: false, adjustment: "draft" as const };
    mocks.data = { planograms: { rows: [adjusting], total: 1, today: "2026-11-16" } };
    mocks.shown = ["planograms"];
    mocks.switches = ["planograms.draft"];
    const { unmount } = render(await HomeCards());
    expect(screen.getByRole("link", { name: /^Front/ })).toHaveAttribute("href", "/planograms/f1/adjust");
    unmount();
    mocks.switches = ["planograms.publish"];
    render(await HomeCards());
    expect(screen.getByRole("link", { name: /^Front/ })).toHaveAttribute("href", "/planograms/f1");
  });

  it("renders Sold out on display from its slice, between Planograms to finish and Not placed yet", async () => {
    mocks.data = {
      planograms: { rows: [{ fixtureId: "f1", name: "Front", typeLabel: "Rack", publishedVersion: null, publishedAt: null, hasDraft: true, dueDate: null, overdue: false }], total: 1, today: "2026-11-16" },
      soldOut: { products: 2 },
      notPlaced: { products: 2, fixtures: 0 },
    };
    mocks.shown = ["planograms", "soldOut", "notPlaced"];
    render(await HomeCards());
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Planograms to finish", "Sold out on display", "Not placed yet"]);
  });

  it("renders the store and team cards from their slices", async () => {
    mocks.data = {
      setup: [{ key: "team", label: "Invite your team", href: "/store" }],
      invitations: [{ id: "i1", email: "ana@example.test", roleName: "Sales Associate", state: "pending", expiresAt: new Date("2026-11-20T18:00:00Z") }],
      changes: [{ id: "c1", text: "Van removed Lee", at: new Date("2026-11-15T18:00:00Z") }],
    };
    mocks.shown = ["setup", "invitations", "changes"];
    render(await HomeCards());
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Set up the store", "Invitations waiting", "Recent changes"]);
  });

  it("never prints an email when the data carries no invitations", async () => {
    mocks.data = { changes: [{ id: "c1", text: "Van removed Lee", at: new Date("2026-11-15T18:00:00Z") }] };
    mocks.shown = ["invitations", "changes"];
    const { container } = render(await HomeCards());
    expect(screen.queryByRole("heading", { name: "Invitations waiting" })).toBeNull();
    expect(container.textContent).not.toContain("@");
  });
});
