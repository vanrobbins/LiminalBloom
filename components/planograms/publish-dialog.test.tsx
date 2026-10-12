import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShellProvider } from "@/components/shell/shell-context";

import { PublishDialog } from "./publish-dialog";

const actions = vi.hoisted(() => ({ previewPublishAction: vi.fn(), publishAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const change = (label: string, added: number, moved: number) => ({
  faceId: label, label, added: Array(added).fill({}), removed: [], moved: Array(moved).fill({}), recounted: [],
});

describe("PublishDialog", () => {
  beforeEach(() => vi.resetAllMocks());

  it("groups changes by face and publishes the next version", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 7, basedOnVersion: 4, nextNumber: 5, changes: [change("Front", 3, 1), change("Back", 1, 0)], issues: [], isEmpty: false });
    actions.publishAction.mockResolvedValue({ status: "saved", message: "Version 5 published" });
    render(<PublishDialog open onOpenChange={vi.fn()} fixtureId="fx" />);
    expect(await screen.findByText("Front: 3 added, 1 moved")).toBeInTheDocument();
    expect(screen.getByText("Back: 1 added")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Summary (optional)"), "October denim reset");
    await userEvent.click(screen.getByRole("button", { name: /^Publish to / }));
    expect(actions.publishAction).toHaveBeenCalledWith("fx", 7, 4, "October denim reset");
  });

  it("asks before publishing an empty draft", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 2, basedOnVersion: null, nextNumber: 1, changes: [], issues: [], isEmpty: true });
    render(<PublishDialog open onOpenChange={vi.fn()} fixtureId="fx" />);
    expect(await screen.findByText("This clears the fixture. Publish anyway?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish anyway" })).toBeInTheDocument();
  });

  it("lists what blocks publishing and offers no publish button", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 2, basedOnVersion: null, nextNumber: 1, changes: [], issues: [{ id: "p", productName: "Crew Sock", message: "Off the edge of the face" }], isEmpty: false });
    render(<PublishDialog open onOpenChange={vi.fn()} fixtureId="fx" />);
    expect(await screen.findByText("Crew Sock: Off the edge of the face")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish/ })).toBeNull();
  });

  it("shows a refusal and reloads the preview", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 2, basedOnVersion: null, nextNumber: 1, changes: [change("Top", 1, 0)], issues: [], isEmpty: false });
    actions.publishAction.mockResolvedValue({ status: "refused", message: "The draft changed on another device — review the changes" });
    render(<PublishDialog open onOpenChange={vi.fn()} fixtureId="fx" />);
    await userEvent.click(await screen.findByRole("button", { name: /^Publish to / }));
    expect(await screen.findByText("The draft changed on another device — review the changes")).toBeInTheDocument();
    expect(actions.previewPublishAction).toHaveBeenCalledTimes(2);
  });

  it("keeps the refusal on screen when the draft is gone after it", async () => {
    actions.previewPublishAction
      .mockResolvedValueOnce({ planogramVersion: 2, basedOnVersion: null, nextNumber: 1, changes: [change("Top", 1, 0)], issues: [], isEmpty: false })
      .mockResolvedValueOnce(null);
    actions.publishAction.mockResolvedValue({ status: "refused", message: "Version 1 was published while you were editing — review the changes" });
    render(<PublishDialog open onOpenChange={vi.fn()} fixtureId="fx" />);
    await userEvent.click(await screen.findByRole("button", { name: /^Publish to / }));
    expect(await screen.findByText("This draft is no longer open. Close and reload.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Version 1 was published while you were editing — review the changes");
  });

  it("names the store in the title, button and version", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 2, basedOnVersion: null, nextNumber: 1, changes: [], issues: [], isEmpty: false });
    render(
      <ShellProvider value={{ stores: [{ id: "s", name: "Pioneer Place" }], activeStoreId: "s", user: { name: "Van", email: "v@x.co" } }}>
        <PublishDialog open onOpenChange={vi.fn()} fixtureId="fx" />
      </ShellProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Publish to Pioneer Place?" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Publish to Pioneer Place" })).toBeInTheDocument();
    expect(screen.getByText("Becomes version 1.")).toBeInTheDocument();
  });
});
