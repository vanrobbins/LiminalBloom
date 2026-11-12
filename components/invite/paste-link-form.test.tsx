import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { EMPTY_TEXT, NOT_A_LINK_TEXT, PasteLinkForm } from "./paste-link-form";

const ID = "Zk3p-_Q9aB2cD4eF5gH6iJ7kL8mN0oPq";

beforeEach(() => vi.clearAllMocks());

async function accept(pasted: string) {
  const user = userEvent.setup();
  render(<PasteLinkForm />);
  if (pasted) {
    await user.click(screen.getByLabelText("Invite link or code"));
    await user.paste(pasted);
  }
  await user.click(screen.getByRole("button", { name: "Accept" }));
}

describe("PasteLinkForm", () => {
  it("has a labelled field and an Accept button", () => {
    render(<PasteLinkForm />);
    expect(screen.getByLabelText("Invite link or code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
  });

  it.each([
    ["a full link on any host", `https://liminal.example.test/invite/${ID}`],
    ["a link with no https://", `localhost:3000/invite/${ID}`],
    ["a bare id", ID],
    ["a link with spaces around it", `  http://localhost:3000/invite/${ID}\n`],
  ])("opens the invitation page for %s", async (_what, pasted) => {
    await accept(pasted);
    expect(router.push).toHaveBeenCalledExactlyOnceWith(`/invite/${ID}`);
    expect(screen.queryByText(NOT_A_LINK_TEXT)).toBeNull();
  });

  it("opens the page on Enter in the field too", async () => {
    const user = userEvent.setup();
    render(<PasteLinkForm />);
    await user.type(screen.getByLabelText("Invite link or code"), `${ID}{Enter}`);
    expect(router.push).toHaveBeenCalledWith(`/invite/${ID}`);
  });

  it("says so beside the field, tied to it for a screen reader, when the text isn't an invite, and goes nowhere", async () => {
    await accept("https://example.test/products");
    expect(router.push).not.toHaveBeenCalled();
    const field = screen.getByLabelText("Invite link or code");
    expect(screen.getByText(NOT_A_LINK_TEXT)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(NOT_A_LINK_TEXT);
  });

  it("asks for something to be pasted when the field is empty, and clears the message when typing resumes", async () => {
    const user = userEvent.setup();
    await accept("");
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Invite link or code"), "x");
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
  });
});
