import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeData } from "@/lib/home/types";

const mocks = vi.hoisted(() => ({ data: {} as HomeData, shown: [] as string[] }));

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/current-member", () => ({ requireMember: async () => ({ id: "m" }) }));
vi.mock("@/lib/home/load", () => ({ loadHome: async () => mocks.data }));
vi.mock("@/lib/home/cards", () => ({ shownCards: () => mocks.shown }));

import { HomeCards } from "./home-cards";

beforeEach(() => {
  mocks.data = {};
  mocks.shown = [];
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
});
