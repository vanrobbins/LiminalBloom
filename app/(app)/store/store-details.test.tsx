import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({ renameStoreAction: vi.fn(), saveTimezoneAction: vi.fn() }));

import { StoreDetails } from "./store-details";

const DETAILS = { name: "Pioneer Place", zone: "America/Los_Angeles", version: 1 };

describe("StoreDetails", () => {
  it("holds the two forms for someone who can change them, with no Save button and no reason line", () => {
    render(<StoreDetails {...DETAILS} canManage />);
    expect(screen.getByRole("region", { name: "Store details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Store name")).toHaveValue("Pioneer Place");
    expect(screen.getByRole("button", { name: /^Time zone/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(screen.queryByText("Your role can't change these.")).toBeNull();
    // The time zone keeps its whole hint (spec: the forms keep their existing hints).
    expect(screen.getByText(/show in your own device.s time/)).toBeInTheDocument();
  });

  it("is a name and zone list and one reason for someone who cannot", () => {
    render(<StoreDetails {...DETAILS} canManage={false} />);
    expect(screen.queryByLabelText("Store name")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Time zone/ })).toBeNull();
    expect(screen.getByText("Name").nextElementSibling).toHaveTextContent("Pioneer Place");
    expect(screen.getByText("Time zone").nextElementSibling).toHaveTextContent(/Pacific/);
    expect(screen.getByRole("button", { name: "What's store time?" })).toBeInTheDocument();
    expect(screen.getAllByText("Your role can't change these.")).toHaveLength(1);
  });
});
