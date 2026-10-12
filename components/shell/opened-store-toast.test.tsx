import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { markSignedIn, OpenedStoreToast } from "./opened-store-toast";
import { ShellProvider, type ShellValue } from "./shell-context";

const user = { name: "Van", email: "v@x.co" };
const two: ShellValue = { stores: [{ id: "a", name: "Pioneer Place" }, { id: "b", name: "Washington Square" }], activeStoreId: "b", user };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("OpenedStoreToast", () => {
  it("names the reopened store once, right after sign-in", () => {
    markSignedIn();
    const { rerender } = render(<ShellProvider value={two}><OpenedStoreToast /></ShellProvider>);
    rerender(<ShellProvider value={{ ...two }}><OpenedStoreToast /></ShellProvider>);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({ tone: "success", title: "Opened Washington Square" });
  });

  it("says nothing on an ordinary visit", () => {
    render(<ShellProvider value={two}><OpenedStoreToast /></ShellProvider>);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("says nothing to someone in one store", () => {
    markSignedIn();
    render(<ShellProvider value={{ ...two, stores: [two.stores[1]] }}><OpenedStoreToast /></ShellProvider>);
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
