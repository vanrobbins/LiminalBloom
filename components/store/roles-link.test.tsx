import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RolesLink } from "./roles-link";

describe("RolesLink", () => {
  it("is a link named Roles and permissions to /store/roles, at least 44 px tall", () => {
    render(<RolesLink />);
    const link = screen.getByRole("link", { name: "Roles and permissions" });
    expect(link).toHaveAttribute("href", "/store/roles");
    expect(link.className).toContain("min-h-11");
  });
});
