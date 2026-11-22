import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeData } from "@/lib/home/types";

const mocks = vi.hoisted(() => ({ data: {} as HomeData, shown: [] as string[] }));

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
});
