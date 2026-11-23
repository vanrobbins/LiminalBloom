import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ open: vi.fn(), push: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/(app)/help/actions", () => ({ openHelpAction: mocks.open }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { ASKABLE_KINDS } from "@/lib/help/kinds";

import { HelpForm } from "./help-form";

const BODY = "My planogram will not open.";
beforeEach(() => vi.clearAllMocks());

async function fillAndSend(body = BODY) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Message" }), body);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

describe("HelpForm", () => {
  it("offers the three kinds, preselects the one it was given, and warns what Liminal Bloom cannot see", () => {
    render(<HelpForm kinds={ASKABLE_KINDS} initialKind="broken" from={null} />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0].textContent)).toEqual(["Account or access", "Something isn't working", "Something else"]);
    expect(screen.getByRole("radio", { name: "Something isn't working" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAccessibleDescription(/can't see your store's products, map or planograms.*Never send a password/);
  });

  it("will not send under 10 characters", async () => {
    render(<HelpForm kinds={ASKABLE_KINDS} initialKind="account" from={null} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Message" }), "too short");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends only the kind, the message and where it came from, then opens the thread", async () => {
    mocks.open.mockResolvedValue({ status: "done", id: "t1" });
    render(<HelpForm kinds={ASKABLE_KINDS} initialKind="account" from="/paused" />);
    await userEvent.setup().click(screen.getByRole("radio", { name: "Something else" }));
    await fillAndSend();
    expect(mocks.open).toHaveBeenCalledWith({ kind: "other", body: BODY, from: "/paused" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/help/t1"));
  });

  it("shows the five-open refusal under the form and stays put, with no toast", async () => {
    mocks.open.mockResolvedValue({ status: "too-many-open" });
    render(<HelpForm kinds={ASKABLE_KINDS} initialKind="account" from={null} />);
    await fillAndSend();
    expect(await screen.findByText(/already have 5 open requests/)).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("shows a message refusal under the field, linked to it", async () => {
    mocks.open.mockResolvedValue({ status: "invalid-body" });
    render(<HelpForm kinds={ASKABLE_KINDS} initialKind="account" from={null} />);
    await fillAndSend();
    expect(await screen.findByRole("textbox", { name: "Message" })).toHaveAccessibleDescription(/Write 10 to 2000 characters/);
  });

  it("a lost connection is the one toast, and keeps what was typed", async () => {
    mocks.open.mockRejectedValue(new Error("offline"));
    render(<HelpForm kinds={ASKABLE_KINDS} initialKind="account" from={null} />);
    await fillAndSend();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" })));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(BODY);
  });
});
