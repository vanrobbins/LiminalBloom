import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "./dialog";

describe("Dialog", () => {
  it("is named by its title and described by its description", () => {
    render(
      <Dialog open onOpenChange={() => {}} title="Delete Front tables?" description="Its 5 fixtures stay on the map.">
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete Front tables?" });
    expect(dialog).toHaveAccessibleDescription("Its 5 fixtures stay on the map.");
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Set up your store">
        <p>Body</p>
      </Dialog>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
