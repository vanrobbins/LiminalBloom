import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("has a visible label that names the field, and a hint tied to it", () => {
    render(<Textarea label="Message" hint="Never send a password." />);
    const field = screen.getByRole("textbox", { name: "Message" });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAccessibleDescription("Never send a password.");
  });

  it("marks the field invalid and reads its error with it", () => {
    render(<Textarea label="Message" error="Write 10 to 2000 characters." />);
    const field = screen.getByRole("textbox", { name: "Message" });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription("Write 10 to 2000 characters.");
  });

  it("passes the usual textarea props through", () => {
    render(<Textarea label="Message" maxLength={2000} rows={5} required />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute("maxlength", "2000");
  });
});
