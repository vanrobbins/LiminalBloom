import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  switchStore: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/app/(app)/switch-store-actions", () => ({
  switchStore: mocks.switchStore,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { StoreSwitcher } from "./store-switcher";

const STORES = [
  { id: "store-a", name: "Pioneer Place" },
  { id: "store-b", name: "Washington Square" },
];

function store(name: string) {
  return screen
    .getByRole("radiogroup", { name: "Stores" })
    .querySelector(`button[data-store-name="${name}"]`) as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.switchStore.mockResolvedValue({ status: "switched" });
});

describe("StoreSwitcher grouped by company and region", () => {
  const COMPANY_STORES = [
    {
      id: "a",
      name: "Pioneer Place",
      companyId: "co",
      companyName: "Acme Coffee",
      regionName: "North",
    },
    {
      id: "b",
      name: "Lakeview",
      companyId: "co",
      companyName: "Acme Coffee",
      regionName: null,
    },
    {
      id: "c",
      name: "Corner Cafe",
      companyId: null,
      companyName: null,
      regionName: null,
    },
  ];

  it("labels the company, each region with its count, No region and Standalone", () => {
    render(
      <StoreSwitcher
        stores={COMPANY_STORES}
        activeStoreId="a"
        companyName="Acme Coffee"
      />,
    );
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Acme Coffee",
      "North · 1",
      "No region",
      "Standalone",
    ]);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Pioneer Place",
      "Lakeview",
      "Corner Cafe",
    ]);
  });

  it("names each group for screen readers and puts its stores inside it", () => {
    render(
      <StoreSwitcher
        stores={COMPANY_STORES}
        activeStoreId="a"
        companyName="Acme Coffee"
      />,
    );
    const acme = screen.getByRole("group", { name: "Acme Coffee" });
    expect(
      within(acme).getByRole("group", { name: "North · 1" }),
    ).toContainElement(screen.getByRole("radio", { name: "Pioneer Place" }));
    expect(
      within(acme).getByRole("group", { name: "No region" }),
    ).toContainElement(screen.getByRole("radio", { name: "Lakeview" }));
    expect(
      within(acme).queryByRole("radio", { name: "Corner Cafe" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Standalone" })).toContainElement(
      screen.getByRole("radio", { name: "Corner Cafe" }),
    );
  });

  it("keeps the arrow keys moving through stores across the groups", async () => {
    const user = userEvent.setup();
    render(
      <StoreSwitcher
        stores={COMPANY_STORES}
        activeStoreId="a"
        companyName="Acme Coffee"
      />,
    );
    await user.tab();
    expect(store("Pioneer Place")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(store("Lakeview")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(store("Corner Cafe")).toHaveFocus();
  });

  it("keeps a standalone-only list exactly as before, with no headings", () => {
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});
