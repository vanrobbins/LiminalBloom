import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PageHeader } from "./page-header";
import { ShellProvider, type ShellValue } from "./shell-context";

const user = { name: "Van", email: "v@x.co" };
const two: ShellValue = { stores: [{ id: "a", name: "Pioneer Place" }, { id: "b", name: "Washington Square" }], activeStoreId: "a", user };
const one: ShellValue = { stores: [{ id: "a", name: "Pioneer Place" }], activeStoreId: "a", user };

describe("PageHeader", () => {
  it("draws one h1, the back links and the account menu", () => {
    render(
      <ShellProvider value={two}>
        <PageHeader title="Table 1" back={{ href: "/planograms", label: "Planograms" }} />
      </ShellProvider>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Back to Planograms" })).toHaveAttribute("href", "/planograms");
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("shows the store line for someone in two stores", () => {
    render(
      <ShellProvider value={two}>
        <PageHeader title="Planograms" />
      </ShellProvider>,
    );
    expect(screen.getByRole("button", { name: "Pioneer Place, switch store" })).toBeInTheDocument();
  });

  it("has no store line for someone in one store (council 10-10)", () => {
    render(
      <ShellProvider value={one}>
        <PageHeader title="Planograms" />
      </ShellProvider>,
    );
    expect(screen.queryByRole("button", { name: /switch store/ })).not.toBeInTheDocument();
  });

  it("keeps a long title on one line, whole in its title attribute (Review Focus 1)", () => {
    const long = "Denim Wall · Bay 3 · Spring Reset North";
    render(<PageHeader title={long} />);
    const h1 = screen.getByRole("heading", { level: 1, name: long });
    expect(h1).toHaveAttribute("title", long);
  });
});
