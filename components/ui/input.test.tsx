import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("is named by its visible label", () => {
    render(<Input label="Work email" name="email" type="email" />);
    expect(screen.getByLabelText("Work email")).toHaveAttribute("type", "email");
  });

  it("is not marked invalid without an error", () => {
    render(<Input label="Store name" name="name" />);
    expect(screen.getByLabelText("Store name")).not.toHaveAttribute("aria-invalid");
  });

  it("marks itself invalid and is described by its error", () => {
    render(<Input label="Store name" name="name" error="Give the store a name." />);
    const field = screen.getByLabelText("Store name");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Give the store a name.");
  });

  it("is described by its hint", () => {
    render(<Input label="Password" name="password" hint="At least 8 characters." />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "At least 8 characters.",
    );
  });

  it("hides a password until the toggle is pressed, then shows it", async () => {
    const user = userEvent.setup();
    render(<Input label="Password" name="password" type="password" />);

    const field = screen.getByLabelText("Password", { selector: "input" });
    expect(field).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("passes autocomplete through, so password managers still work", () => {
    render(
      <Input label="Password" name="password" type="password" autoComplete="current-password" />,
    );
    expect(screen.getByLabelText("Password", { selector: "input" })).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("keeps a password's error wired up too", () => {
    render(<Input label="Password" name="password" type="password" error="Too short." />);
    const field = screen.getByLabelText("Password", { selector: "input" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Too short.");
  });
});
