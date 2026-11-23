import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ changeStatus: vi.fn() }));
vi.mock("@/app/(app)/products/status-actions", () => actions);
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import { EVERYTHING } from "@/lib/access/test-guard";
import type { ProductRow } from "@/lib/products/queries";

import { StatusControl } from "./status-control";

const product: ProductRow = { id: "p1", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "", status: "sold_out", version: 3, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid" };

beforeEach(() => vi.clearAllMocks());

describe("StatusControl: the sold-out line (0.7.0.9 task 7a)", () => {
  it("says a sold-out product is still on display, in the live line", () => {
    render(<StatusControl member={EVERYTHING} product={product} displays={2} onChanged={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Sold out. On 2 displays.");
  });

  it("says 'On 1 display' for one", () => {
    render(<StatusControl member={EVERYTHING} product={product} displays={1} onChanged={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Sold out. On 1 display.");
  });

  it("stays empty with no floor location (a stockroom bin is not a display)", () => {
    render(<StatusControl member={EVERYTHING} product={product} displays={0} onChanged={vi.fn()} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("stays empty when the product is not sold out", () => {
    render(<StatusControl member={EVERYTHING} product={{ ...product, status: "on_sale" }} displays={2} onChanged={vi.fn()} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("is the same live line a refusal uses: the refusal wins while it shows", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "forbidden" });
    render(<StatusControl member={EVERYTHING} product={product} displays={2} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "In stock" }));
    expect(screen.getByRole("status")).toHaveTextContent("Your role can't make that change. The status was not changed.");
  });
});
