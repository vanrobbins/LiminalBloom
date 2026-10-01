import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

function Example({ onValueChange = () => {} }: { onValueChange?: (value: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Stores menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Stores</DropdownMenuLabel>
        <DropdownMenuRadioGroup value="a" onValueChange={onValueChange}>
          <DropdownMenuRadioItem value="a">Pioneer Place</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="b">Washington Square</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>New store</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Keyboard, not a click: Radix opens on pointerdown, which jsdom only
// half-simulates. Enter on the focused button is what a keyboard user does.
async function open(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole("button", { name: "Stores menu" }).focus();
  await user.keyboard("{Enter}");
  return screen.findByRole("menu");
}

describe("DropdownMenu", () => {
  it("opens from its button and marks the current choice", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await open(user);

    expect(screen.getByRole("menuitemradio", { name: "Pioneer Place" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Washington Square" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reports a choice and closes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);

    await open(user);
    await user.click(screen.getByRole("menuitemradio", { name: "Washington Square" }));

    expect(onValueChange).toHaveBeenCalledWith("b");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("Escape closes it and puts focus back on its button", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await open(user);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Stores menu" })).toHaveFocus();
  });

  it("makes every item a 44 px touch target", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await open(user);

    const items = [
      ...screen.getAllByRole("menuitemradio"),
      screen.getByRole("menuitem", { name: "New store" }),
    ];
    for (const item of items) {
      expect(item.className).toMatch(/\bmin-h-11\b/);
    }
  });

  it("marks the chosen item gold, the current selection (§5.5)", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await open(user);

    expect(screen.getByRole("menuitemradio", { name: "Pioneer Place" }).className).toContain(
      "data-[state=checked]:bg-brand",
    );
  });

  it("keeps the chosen item gold when keyboard-highlighted", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await open(user);

    expect(screen.getByRole("menuitemradio", { name: "Pioneer Place" }).className).toContain(
      "data-[state=checked]:data-[highlighted]:bg-brand",
    );
  });
});
