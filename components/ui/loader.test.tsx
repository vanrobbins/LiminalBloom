import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Loader } from "./loader";

describe("Loader", () => {
  it("announces the work by name (§3.12.4)", () => {
    render(<Loader label="Loading products…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading products…");
  });
});
