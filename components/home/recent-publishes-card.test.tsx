import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { PublishRow } from "@/lib/home/types";

import { RecentPublishesCard } from "./recent-publishes-card";

const pub = (name: string, version: number, at: string): PublishRow => ({ fixtureId: name.toLowerCase(), fixtureName: name, version, publisherName: "Ana Ruiz", publishedAt: new Date(at) });

describe("RecentPublishesCard", () => {
  it("lists publishes in the order given, each linking to its planogram", () => {
    render(<RecentPublishesCard rows={[pub("Front", 2, "2026-11-15T18:00:00Z"), pub("Wall", 1, "2026-11-14T18:00:00Z")]} />);
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/planograms/front", "/planograms/wall"]);
  });

  it("names fixture, version and publisher in the row's link name", () => {
    render(<RecentPublishesCard rows={[pub("Front", 2, "2026-11-15T18:00:00Z")]} />);
    expect(screen.getByRole("link", { name: "Front, Version 2, published by Ana Ruiz" })).toBeInTheDocument();
  });

  it("shows the moment as a time element", () => {
    const { container } = render(<RecentPublishesCard rows={[pub("Front", 2, "2026-11-15T18:00:00Z")]} />);
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-11-15T18:00:00.000Z");
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
  });

  it("shows at most five rows", () => {
    const rows = Array.from({ length: 7 }, (_, i) => pub(`F${i}`, 1, "2026-11-15T18:00:00Z"));
    render(<RecentPublishesCard rows={rows} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("has no see-all link: each row opens its planogram", () => {
    render(<RecentPublishesCard rows={[pub("Front", 2, "2026-11-15T18:00:00Z")]} />);
    expect(screen.queryByRole("link", { name: /^All / })).toBeNull();
  });
});
