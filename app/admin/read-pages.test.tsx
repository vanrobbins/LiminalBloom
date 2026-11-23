// The admin read pages and the layout (spec 0.7.1 7.2, 7.3). The guard and the reads are stood in for
// (lib/admin/guard.db.test.ts and reads.db.test.ts prove them); what is checked here is that every page awaits
// its guard before reading anything, and what each draws from what it is given.

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  shell: vi.fn(),
  overview: vi.fn(),
  events: vi.fn(),
  stores: vi.fn(),
  store: vi.fn(),
  person: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, usePathname: () => "/admin", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdmin: mocks.guard, adminShellAccount: mocks.shell }));
vi.mock("@/lib/admin/reads", () => ({ adminOverview: mocks.overview, recentEvents: mocks.events, listStores: mocks.stores, storeDetail: mocks.store }));
vi.mock("@/lib/admin/reads-people", () => ({ lookupPerson: mocks.person }));

import AdminLayout from "./layout";
import ActivityPage from "./activity/page";
import OverviewPage from "./page";
import PeoplePage from "./people/page";
import StorePage from "./stores/[id]/page";
import StoresPage from "./stores/page";

const at = new Date("2026-11-20T10:00:00Z");
const event = (over = {}) => ({ id: "e1", actorName: "Ada Admin", action: "store_paused", targetKind: "store", targetLabel: "Pioneer Place", reason: "Billing question", createdAt: at, ...over });
const store = (over = {}) => ({ id: "s1", name: "Pioneer Place", createdAt: at, people: 2, managers: ["Mona Manager"], paused: false, ...over });
const detail = (over = {}) => ({
  id: "s1",
  name: "Pioneer Place",
  createdAt: at,
  pause: null,
  people: [{ userId: "u1", name: "Mona Manager", email: "mona@example.com", roleName: "Store Manager" }],
  invitations: [{ id: "i1", email: "new@example.com", roleName: "Sales Associate", expiresAt: at, expired: false }],
  ...over,
});
const person = (over = {}) => ({
  userId: "u1",
  name: "Mona Manager",
  email: "mona@example.com",
  createdAt: at,
  twoFactorEnabled: true,
  passkeys: 1,
  sessions: 2,
  isAdmin: false,
  stores: [{ id: "s1", name: "Pioneer Place", roleName: "Store Manager", paused: true }],
  invitations: [{ id: "i1", storeId: "s2", storeName: "Other Store", roleName: null, expiresAt: at, expired: true }],
  ...over,
});

const search = (q: Record<string, string>) => Promise.resolve(q);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({});
  mocks.overview.mockResolvedValue({ helpWaiting: 3, events: [event()] });
  mocks.events.mockResolvedValue({ events: [event()], hasMore: false });
  mocks.stores.mockResolvedValue([store()]);
  mocks.store.mockResolvedValue(detail());
  mocks.person.mockResolvedValue(person());
});

describe("every page awaits its guard before it reads anything", () => {
  const pages: [string, () => Promise<unknown>][] = [
    ["overview", () => OverviewPage()],
    ["people", () => PeoplePage({ searchParams: search({ email: "a@b.co" }) })],
    ["stores", () => StoresPage()],
    ["store", () => StorePage({ params: Promise.resolve({ id: "s1" }) })],
    ["activity", () => ActivityPage({ searchParams: search({}) })],
  ];
  it.each(pages)("%s", async (_name, run) => {
    mocks.guard.mockRejectedValue(new Error("redirect:/admin/verify"));
    await expect(run()).rejects.toThrow("redirect:/admin/verify");
    for (const read of [mocks.overview, mocks.events, mocks.stores, mocks.store, mocks.person]) expect(read).not.toHaveBeenCalled();
  });
});

describe("/admin layout (not a guard)", () => {
  it("draws the shell around the page for an admin who may see the area", async () => {
    mocks.shell.mockResolvedValue({ name: "Ada", email: "ada@example.com" });
    render(await AdminLayout({ children: <h1>Page</h1> }));
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Page" })).toBeInTheDocument();
  });
  it("gives everyone else the bare page, so setup and step-up stay reachable and a 404 has no chrome", async () => {
    mocks.shell.mockResolvedValue(null);
    render(await AdminLayout({ children: <h1>Page</h1> }));
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("heading", { name: "Page" })).toBeInTheDocument();
  });
});

describe("/admin overview", () => {
  it("shows the help waiting and the last events", async () => {
    render(await OverviewPage());
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help waiting" }).parentElement).toHaveTextContent("3");
    expect(screen.getByText("Store paused")).toBeInTheDocument();
    expect(screen.getByText(/Billing question/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All activity" })).toHaveAttribute("href", "/admin/activity");
  });
});

describe("/admin/people", () => {
  it("asks for an email before anything is looked up", async () => {
    render(await PeoplePage({ searchParams: search({}) }));
    expect(screen.getByText("Type an email to find a person.")).toBeInTheDocument();
    expect(mocks.person).not.toHaveBeenCalled();
  });
  it("looks up the email in the URL and shows the person's facts, stores and invitations", async () => {
    render(await PeoplePage({ searchParams: search({ email: " Mona@Example.com " }) }));
    expect(mocks.person).toHaveBeenCalledWith("Mona@Example.com");
    expect(screen.getByLabelText("Email")).toHaveValue("Mona@Example.com");
    expect(screen.getByRole("heading", { name: "Mona Manager" })).toBeInTheDocument();
    expect(screen.getByText("On: Authenticator app, 1 passkey")).toBeInTheDocument();
    expect(screen.getByText("2 devices")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pioneer Place" })).toHaveAttribute("href", "/admin/stores/s1");
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText(/Other Store/)).toBeInTheDocument();
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });
  it("says so when no account has the email", async () => {
    mocks.person.mockResolvedValue(null);
    render(await PeoplePage({ searchParams: search({ email: "nobody@example.com" }) }));
    expect(screen.getByText("No account has that email.")).toBeInTheDocument();
  });
});

describe("/admin/stores", () => {
  it("lists each store as a link with its people, Store Managers and pause", async () => {
    mocks.stores.mockResolvedValue([store(), store({ id: "s2", name: "Washington Square", managers: [], paused: true, people: 1 })]);
    render(await StoresPage());
    const rows = screen.getAllByRole("list")[0];
    expect(within(rows).getByRole("link", { name: "Pioneer Place" })).toHaveAttribute("href", "/admin/stores/s1");
    expect(within(rows).getByText("2 people · Mona Manager")).toBeInTheDocument();
    expect(within(rows).getByText("1 person · No Store Manager")).toBeInTheDocument();
    expect(within(rows).getAllByText("Paused")).toHaveLength(1);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  });
});

describe("/admin/stores/[id]", () => {
  it("shows the people with emails and roles, and the invitations waiting", async () => {
    render(await StorePage({ params: Promise.resolve({ id: "s1" }) }));
    expect(mocks.store).toHaveBeenCalledWith("s1");
    expect(screen.getByRole("heading", { level: 1, name: "Pioneer Place" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mona@example.com" })).toHaveAttribute("href", "/admin/people?email=mona%40example.com");
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
  });
  it("shows why a paused store is paused", async () => {
    mocks.store.mockResolvedValue(detail({ pause: { reason: "Unpaid invoice", byName: "Ada Admin", since: at } }));
    render(await StorePage({ params: Promise.resolve({ id: "s1" }) }));
    expect(screen.getByText(/Unpaid invoice/)).toBeInTheDocument();
  });
  it("is a 404 for a store that does not exist", async () => {
    mocks.store.mockResolvedValue(null);
    await expect(StorePage({ params: Promise.resolve({ id: "nope" }) })).rejects.toThrow("notFound");
  });
});

describe("/admin/activity", () => {
  it("reads 50 of everything by default and offers no Show more when that is all", async () => {
    render(await ActivityPage({ searchParams: search({}) }));
    expect(mocks.events).toHaveBeenCalledWith({ limit: 50, kind: undefined });
    expect(screen.queryByRole("link", { name: "Show more" })).toBeNull();
  });
  it("passes the kind and limit from the URL and links to 50 more when there are more", async () => {
    mocks.events.mockResolvedValue({ events: [event()], hasMore: true });
    render(await ActivityPage({ searchParams: search({ kind: "store_paused", limit: "100" }) }));
    expect(mocks.events).toHaveBeenCalledWith({ limit: 100, kind: "store_paused" });
    expect(screen.getByRole("link", { name: "Show more" })).toHaveAttribute("href", "/admin/activity?limit=150&kind=store_paused");
    expect(screen.getByLabelText("Kind")).toHaveValue("store_paused");
  });
  it("ignores a kind it does not offer", async () => {
    render(await ActivityPage({ searchParams: search({ kind: "drop table" }) }));
    expect(mocks.events).toHaveBeenCalledWith({ limit: 50, kind: undefined });
  });
});
