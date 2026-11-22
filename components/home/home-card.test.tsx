import { render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { HomeCard } from "./home-card";

describe("HomeCard", () => {
  it("is a section named by its heading, with a decorative icon", () => {
    const { container } = render(
      <HomeCard title="Planograms to finish" icon={Plus}>
        <p>rows</p>
      </HomeCard>,
    );
    const section = screen.getByRole("region", { name: "Planograms to finish" });
    expect(section).toContainElement(screen.getByRole("heading", { level: 2, name: "Planograms to finish" }));
    expect(container.querySelector("section svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("rows")).toBeVisible();
  });

  it("has no see-all link unless it is given one", () => {
    render(
      <HomeCard title="Not placed yet" icon={Plus}>
        x
      </HomeCard>,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names the page and the remainder on the see-all link", () => {
    render(
      <HomeCard title="Planograms to finish" icon={Plus} seeAll={{ href: "/planograms", page: "planograms", more: 3 }}>
        x
      </HomeCard>,
    );
    expect(screen.getByRole("link", { name: "All planograms, 3 more" })).toHaveAttribute("href", "/planograms");
  });

  it("leaves the remainder out when every row is shown", () => {
    render(
      <HomeCard title="Planograms to finish" icon={Plus} seeAll={{ href: "/planograms", page: "planograms", more: 0 }}>
        x
      </HomeCard>,
    );
    expect(screen.getByRole("link", { name: "All planograms" })).toBeInTheDocument();
  });

  it("gives each card its own heading id, so two cards keep separate names", () => {
    render(
      <>
        <HomeCard title="One" icon={Plus}>
          a
        </HomeCard>
        <HomeCard title="Two" icon={Plus}>
          b
        </HomeCard>
      </>,
    );
    expect(screen.getByRole("region", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Two" })).toBeInTheDocument();
  });
});
