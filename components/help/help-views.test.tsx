// The read-only pieces: the list, the thread, the status word, the banner, the frame and the Ask button.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/help", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/shell/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <header data-shell-header>{title}</header> }));
vi.mock("@/components/corner-theme-toggle", () => ({ CornerThemeToggle: () => null }));

import { AskButton } from "./ask-button";
import { HelpFrame } from "./help-frame";
import { HelpList } from "./help-list";
import { HelpStatusWord } from "./help-status";
import { HelpThread } from "./help-thread";
import { ReplyBanner } from "./reply-banner";

describe("HelpList", () => {
  const item = (over: object) => ({ id: "t1", kind: "broken", status: "open", firstLine: "Map will not load", createdAt: "2026-11-22T20:00:00.000Z", unread: false, ...over }) as never;

  it("says so when there is nothing", () => {
    render(<HelpList items={[]} />);
    expect(screen.getByText("You haven't asked Liminal Bloom for help yet.")).toBeInTheDocument();
  });

  it("links each row to its thread with the kind, first line and status in words", () => {
    render(<HelpList items={[item({}), item({ id: "t2", kind: "account", status: "closed", firstLine: "Locked out" })]} />);
    const rows = screen.getAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(["/help/t1", "/help/t2"]);
    expect(within(rows[0]).getByText("Something isn't working")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Map will not load")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Waiting")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Closed")).toBeInTheDocument();
  });

  it("marks a reply that has not been opened, in words as well as a dot, and only that one", () => {
    render(<HelpList items={[item({ status: "answered", unread: true }), item({ id: "t2", status: "answered" })]} />);
    expect(screen.getAllByText("Replied")).toHaveLength(2);
    expect(screen.getAllByText("New reply")).toHaveLength(1);
  });
});

describe("HelpThread", () => {
  it("signs messages You and Liminal Bloom, oldest first, and shows text as text", () => {
    render(
      <HelpThread
        messages={[
          { id: "m1", fromAdmin: false, body: "<b>bold</b> line one\nline two", createdAt: "2026-11-22T20:00:00.000Z" },
          { id: "m2", fromAdmin: true, body: "Try again now.", createdAt: "2026-11-22T21:00:00.000Z" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("You")).toBeInTheDocument();
    expect(within(items[1]).getByText("Liminal Bloom")).toBeInTheDocument();
    expect(items[0].querySelector("b")).toBeNull();
    expect(within(items[0]).getByText(/<b>bold<\/b> line one/)).toBeInTheDocument();
    expect(items[1]).toHaveAttribute("data-from", "liminal-bloom");
  });
});

describe("HelpStatusWord", () => {
  it.each([["open", "Waiting"], ["answered", "Replied"], ["closed", "Closed"]] as const)("%s reads %s", (status, word) => {
    render(<HelpStatusWord status={status} />);
    expect(screen.getByText(word)).toBeInTheDocument();
  });
});

describe("ReplyBanner", () => {
  it("is nothing without a reply, and links to Help with one", () => {
    const { container, rerender } = render(<ReplyBanner replies={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ReplyBanner replies={1} />);
    expect(screen.getByText("Liminal Bloom replied.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the reply" })).toHaveAttribute("href", "/help");
  });
});

describe("HelpFrame: one route, two frames", () => {
  it("gives a member the shell page, with its header and no bare card", () => {
    render(<HelpFrame kind="member" title="Help">body</HelpFrame>);
    expect(document.querySelector("[data-shell-header]")).toHaveTextContent("Help");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it.each([["no-store", "/welcome"], ["paused", "/paused"], ["needs-two-factor", "/account"]] as const)("gives %s the bare card with one h1 and a way back to %s", (kind, back) => {
    render(<HelpFrame kind={kind} title="Help">body</HelpFrame>);
    expect(screen.getByRole("heading", { level: 1, name: "Help" })).toBeInTheDocument();
    expect(document.querySelector("[data-shell-header]")).toBeNull();
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", back);
  });

  it("a given back link wins in the bare card", () => {
    render(<HelpFrame kind="no-store" title="Ask" back={{ href: "/help", label: "Help" }}>body</HelpFrame>);
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });
});

describe("AskButton", () => {
  it("links to the form with the kind and where it came from", () => {
    render(<AskButton kind="account" from="/paused" />);
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toHaveAttribute("href", "/help/new?kind=account&from=%2Fpaused");
  });

  it("is a plain link to the form with nothing to carry", () => {
    render(<AskButton />);
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toHaveAttribute("href", "/help/new");
  });
});
