import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { GroupableStore } from "@/lib/store-groups";

import { StoreMenuItems, StoreName } from "./store-menu";

const STORES = [
  { id: "store-a", name: "Pioneer Place" },
  { id: "store-b", name: "Washington Square" },
];

// Switching stores lives in the account menu: see user-menu.test.tsx.
describe("StoreName", () => {
  it("is the current store's name on one line, whole in its title, at the sizes that show it", () => {
    for (const variant of ["sheet", "name"] as const) {
      const { unmount } = render(
        <StoreName stores={STORES} activeStoreId="store-a" variant={variant} />,
      );
      const name = screen.getByText("Pioneer Place");
      expect(name).toHaveAttribute("data-store-current", "Pioneer Place");
      expect(name).toHaveAttribute("data-store-label");
      expect(name).toHaveAttribute("title", "Pioneer Place");
      expect(name).toHaveClass("truncate");
      unmount();
    }
  });

  it("follows the active store", () => {
    render(
      <StoreName stores={STORES} activeStoreId="store-b" variant="name" />,
    );
    expect(screen.getByText("Washington Square")).toHaveAttribute(
      "data-store-current",
      "Washington Square",
    );
  });

  it("shows initials on the rail, where the full name does not fit, and says the full name to screen readers", () => {
    render(
      <StoreName stores={STORES} activeStoreId="store-a" variant="initials" />,
    );
    const name = document.querySelector("[data-store-current]")!;
    expect(name).toHaveAttribute("data-store-current", "Pioneer Place");
    expect(name).toHaveTextContent("PPPioneer Place");
    expect(screen.getByText("PP")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Pioneer Place")).toHaveClass("sr-only");
  });

  it("is plain text, never a button", () => {
    for (const variant of ["sheet", "initials", "name"] as const) {
      const { unmount } = render(
        <StoreName stores={STORES} activeStoreId="store-a" variant={variant} />,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe("StoreMenuItems", () => {
  const COMPANY_STORES = [
    {
      id: "a",
      name: "Pioneer Place",
      companyId: "co",
      companyName: "Acme Coffee",
      regionName: "North",
    },
    {
      id: "c",
      name: "Corner Cafe",
      companyId: null,
      companyName: null,
      regionName: null,
    },
  ];

  async function openSwitch(stores: GroupableStore[]) {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <button type="button">Account menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <StoreMenuItems
            stores={stores}
            activeStoreId={stores[0].id}
            switchingTo={null}
            switchTo={async () => true}
          />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Switch store" }),
    );
    return screen.findByRole("menuitemradio", { name: stores[0].name });
  }

  it("labels the company, its region and Standalone in the dropdown", async () => {
    await openSwitch(COMPANY_STORES);
    expect(screen.getByText("Acme Coffee")).toBeInTheDocument();
    expect(screen.getByText("North · 1")).toBeInTheDocument();
    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(
      screen.getAllByRole("menuitemradio").map((r) => r.textContent),
    ).toEqual(["Pioneer Place", "Corner Cafe"]);
  });

  it("shows no group labels for a standalone-only list", async () => {
    await openSwitch(STORES);
    expect(screen.queryByText("Standalone")).not.toBeInTheDocument();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
  });

  it("names each group for screen readers and puts its stores inside it", async () => {
    await openSwitch([
      ...COMPANY_STORES,
      {
        id: "b",
        name: "Lakeview",
        companyId: "co",
        companyName: "Acme Coffee",
        regionName: null,
      },
    ]);
    const acme = screen.getByRole("group", { name: "Acme Coffee" });
    expect(
      within(acme).getByRole("menuitemradio", { name: "Pioneer Place" }),
    ).toBeInTheDocument();
    expect(
      within(acme).getByRole("menuitemradio", { name: "Lakeview" }),
    ).toBeInTheDocument();
    expect(
      within(acme).queryByRole("menuitemradio", { name: "Corner Cafe" }),
    ).not.toBeInTheDocument();

    expect(
      within(acme).getByRole("group", { name: "North · 1" }),
    ).toContainElement(
      screen.getByRole("menuitemradio", { name: "Pioneer Place" }),
    );
    expect(
      within(acme).getByRole("group", { name: "No region" }),
    ).toContainElement(screen.getByRole("menuitemradio", { name: "Lakeview" }));
    expect(screen.getByRole("group", { name: "Standalone" })).toContainElement(
      screen.getByRole("menuitemradio", { name: "Corner Cafe" }),
    );
  });
});
