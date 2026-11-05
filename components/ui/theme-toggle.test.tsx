import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: mocks.setTheme }),
}));

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("is an icon button named for what it does", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: "Switch to light" });
    expect(button.querySelector("svg")).not.toBeNull();
    // Button reads its tooltip from this attribute, and throws in development without it.
    expect(button).toHaveAttribute("aria-label", "Switch to light");

    await user.click(button);
    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });
});
