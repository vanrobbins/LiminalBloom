import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ pickerSearch: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const media = vi.hoisted(() => ({ phone: false }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "phone", useMediaQuery: () => media.phone }));

import { AddProductDialog } from "./add-product-dialog";

const tee = { id: "tee", name: "Pocket Tee", styleNumber: "PT-1", footprints: { folded: { columns: 2, rows: 1 }, hung: { columns: 2, rows: 1 } } };

describe("AddProductDialog", () => {
  beforeEach(() => {
    actions.pickerSearch.mockReset().mockResolvedValue([tee]);
    media.phone = false;
  });

  it("shows products to pick before anything is typed (UX audit U23)", async () => {
    render(<AddProductDialog open onOpenChange={() => {}} onPick={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /Pocket Tee/ })).toBeInTheDocument();
    expect(actions.pickerSearch).toHaveBeenCalledWith("");
  });

  it("is a bottom sheet on a phone, like everything else there", async () => {
    media.phone = true;
    render(<AddProductDialog open onOpenChange={() => {}} onPick={vi.fn()} />);
    const sheet = screen.getByRole("dialog", { name: "Add product" });
    expect(sheet.closest("[data-vaul-drawer]") ?? sheet.hasAttribute("data-vaul-drawer")).toBeTruthy();
    await userEvent.setup().type(screen.getByLabelText("Find a product"), "Tee");
    expect(await screen.findByRole("button", { name: /Pocket Tee/ })).toBeInTheDocument();
  });
});
