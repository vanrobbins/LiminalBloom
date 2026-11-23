// /admin/requests and /admin/requests/[id] (spec 0.7.1 5.3, 7.3). The guard and the reads are stood in for
// (lib/admin/guard.db.test.ts and request-reads.db.test.ts prove them); what is checked here is that each page
// awaits its guard before reading anything, and what each draws: the queue, the facts, and which buttons.

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdmin: mocks.guard }));
vi.mock("@/lib/admin/request-reads", () => ({ adminRequestList: mocks.list, adminRequestDetail: mocks.detail }));
vi.mock("./actions", () => ({ approveRequestAction: vi.fn(), rejectRequestAction: vi.fn(), askQuestionAction: vi.fn() }));

import RequestPage from "./[id]/page";
import RequestsPage from "./page";

const at = new Date("2026-11-20T10:00:00Z");
const item = (over = {}) => ({ id: "r1", name: "Acme", status: "pending", requesterName: "Rita Requester", createdAt: at, decidedAt: at, ...over });
const detail = (over = {}) => ({
  id: "r1",
  version: 2,
  name: "Acme",
  status: "pending",
  createdAt: at,
  decidedAt: at,
  decidedByName: null,
  reason: null,
  requester: { name: "Rita Requester", email: "rita@example.test", createdAt: at, stores: [{ id: "s1", name: "Pioneer Place", roleName: "Store Manager" }], company: null },
  thread: null,
  ...over,
});
const params = (id = "r1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({});
  mocks.list.mockResolvedValue({ pending: [item()], decided: [item({ id: "r2", name: "Globex", status: "rejected" })] });
  mocks.detail.mockResolvedValue(detail());
});

describe("every page awaits its guard before it reads anything", () => {
  it.each([
    ["list", () => RequestsPage(), () => mocks.list],
    ["detail", () => RequestPage(params()), () => mocks.detail],
  ])("%s", async (_name, run, read) => {
    mocks.guard.mockRejectedValue(new Error("redirect:/admin/verify"));
    await expect(run()).rejects.toThrow("redirect:/admin/verify");
    expect(read()).not.toHaveBeenCalled();
  });
});

describe("/admin/requests", () => {
  it("lists the waiting ones first and the decided ones after, each a link to its request", async () => {
    render(await RequestsPage());
    expect(screen.getByRole("heading", { level: 1, name: "Company requests" })).toBeInTheDocument();
    const waiting = screen.getByRole("region", { name: /Waiting/ });
    expect(within(waiting).getByRole("link")).toHaveAttribute("href", "/admin/requests/r1");
    expect(within(waiting).getByRole("link")).toHaveTextContent("AcmeWaitingRita Requester");
    const decided = screen.getByRole("region", { name: /Decided/ });
    expect(within(decided).getByRole("link")).toHaveAttribute("href", "/admin/requests/r2");
    expect(within(decided).getByRole("link")).toHaveTextContent("GlobexRejected");
  });

  it("says so when nothing is waiting", async () => {
    mocks.list.mockResolvedValue({ pending: [], decided: [] });
    render(await RequestsPage());
    expect(screen.getByText("No company requests are waiting.")).toBeInTheDocument();
    expect(screen.getByText("Nothing decided yet.")).toBeInTheDocument();
  });
});

describe("/admin/requests/[id]", () => {
  it("shows a waiting request with Approve, Reject and Ask a question, and who asked", async () => {
    render(await RequestPage(params()));
    expect(screen.getByRole("heading", { level: 1, name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ask a question" })).toBeInTheDocument();
    expect(screen.getByText("rita@example.test")).toBeInTheDocument();
    expect(screen.getByText("Pioneer Place (Store Manager)")).toBeInTheDocument();
    expect(screen.getByText("None", { selector: "dd" })).toBeInTheDocument();
  });

  it("shows the thread and a link to it in Help when there is one", async () => {
    const message = { id: "m1", fromAdmin: true, authorName: "Ada Admin", body: "How many stores?", createdAt: at };
    mocks.detail.mockResolvedValue(detail({ thread: { id: "t1", status: "answered", messages: [message] } }));
    render(await RequestPage(params()));
    expect(screen.getByText("How many stores?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Help" })).toHaveAttribute("href", "/admin/help/t1");
    expect(screen.getByRole("textbox", { name: "Ask another question" })).toBeInTheDocument();
  });

  it("warns that approving takes the person out of the company they are in", async () => {
    mocks.detail.mockResolvedValue(detail({ requester: { ...detail().requester, company: { id: "c", name: "Globex", role: "corporate_admin" } } }));
    render(await RequestPage(params()));
    expect(screen.getByText("Globex, corporate admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("does not offer Approve to an owner, and says who to wait on", async () => {
    mocks.detail.mockResolvedValue(detail({ requester: { ...detail().requester, company: { id: "c", name: "Globex", role: "owner" } } }));
    render(await RequestPage(params()));
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByText(/Waiting on Rita Requester to hand off Globex/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("shows a decided request's outcome and reason with no buttons and no question form", async () => {
    mocks.detail.mockResolvedValue(detail({ status: "rejected", decidedByName: "Ada Admin", reason: "Cannot verify" }));
    render(await RequestPage(params()));
    expect(screen.getByText(/Rejected by Ada Admin/)).toHaveTextContent("Reason: Cannot verify");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("is a 404 for an unknown request", async () => {
    mocks.detail.mockResolvedValue(null);
    await expect(RequestPage(params("nope"))).rejects.toThrow("notFound");
  });
});
