// The admin pages with their help actions (spec 0.7.1 7.4, 7.1): who gets which button, and that /admin/admins
// awaits its guard before it reads. The guard and the reads are stood in for (lib/admin/*.db.test.ts prove them).

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), store: vi.fn(), person: vi.fn(), admins: vi.fn() }));

vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdmin: mocks.guard }));
vi.mock("@/lib/admin/reads", () => ({ storeDetail: mocks.store }));
vi.mock("@/lib/admin/reads-people", () => ({ lookupPerson: mocks.person }));
vi.mock("@/lib/admin/admins", () => ({ listAdmins: mocks.admins }));
vi.mock("./people/actions", () => ({ signOutEverywhereAction: vi.fn(), cancelInvitationAction: vi.fn(), resetTwoFactorAction: vi.fn() }));
vi.mock("./stores/actions", () => ({ pauseStoreAction: vi.fn(), restoreStoreAction: vi.fn(), makeStoreManagerAction: vi.fn() }));
vi.mock("./admins/actions", () => ({ addAdminAction: vi.fn(), removeAdminAction: vi.fn() }));

import AdminsPage from "./admins/page";
import PeoplePage from "./people/page";
import StorePage from "./stores/[id]/page";

const at = new Date("2026-11-20T10:00:00Z");
const detail = (over = {}) => ({
  id: "s1",
  name: "Pioneer Place",
  createdAt: at,
  pause: null,
  people: [
    { userId: "u1", name: "Mona Manager", email: "mona@example.com", roleName: "Store Manager", isManager: true },
    { userId: "u2", name: "Sam Sales", email: "sam@example.com", roleName: "Sales Associate", isManager: false },
  ],
  invitations: [{ id: "i1", email: "new@example.com", roleName: "Sales Associate", expiresAt: at, expired: false }],
  ...over,
});
const person = (over = {}) => ({ userId: "u2", name: "Sam Sales", email: "sam@example.com", createdAt: at, twoFactorEnabled: true, passkeys: 0, sessions: 1, isAdmin: false, stores: [], invitations: [], ...over });
const search = (q: Record<string, string>) => Promise.resolve(q);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ userId: "u1" });
  mocks.store.mockResolvedValue(detail());
  mocks.person.mockResolvedValue(person());
  mocks.admins.mockResolvedValue([{ userId: "u1", name: "Ada", email: "ada@example.com", addedByName: "Liminal Bloom script", createdAt: at }]);
});

describe("/admin/stores/[id] actions", () => {
  it("offers Pause for a running store and Make Store Manager only to people who are not one; each invitation can be canceled", async () => {
    render(await StorePage({ params: Promise.resolve({ id: "s1" }) }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Make Store Manager" })).toHaveLength(1);
    const sam = screen.getByText("Sam Sales").closest("li")!;
    expect(within(sam).getByRole("button", { name: "Make Store Manager" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Cancel invitation" })).toHaveLength(1);
  });

  it("offers Restore, not Pause, for a paused store", async () => {
    mocks.store.mockResolvedValue(detail({ pause: { reason: "Unpaid invoice", byName: "Ada", since: at } }));
    render(await StorePage({ params: Promise.resolve({ id: "s1" }) }));
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });
});

describe("/admin/people actions", () => {
  it("offers Sign out everywhere and Reset to an ordinary account with a session and two-step sign-in", async () => {
    render(await PeoplePage({ searchParams: search({ email: "sam@example.com" }) }));
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset two-step sign-in" })).toBeInTheDocument();
  });

  it("offers no Reset for a Liminal Bloom admin (the script's alone) but still Sign out everywhere", async () => {
    mocks.person.mockResolvedValue(person({ isAdmin: true }));
    render(await PeoplePage({ searchParams: search({ email: "sam@example.com" }) }));
    expect(screen.queryByRole("button", { name: "Reset two-step sign-in" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeInTheDocument();
  });

  it("offers no Reset when there is no two-step sign-in to reset", async () => {
    mocks.person.mockResolvedValue(person({ twoFactorEnabled: false, passkeys: 0 }));
    render(await PeoplePage({ searchParams: search({ email: "sam@example.com" }) }));
    expect(screen.queryByRole("button", { name: "Reset two-step sign-in" })).toBeNull();
  });

  it("cancels a waiting invitation from the person's page", async () => {
    mocks.person.mockResolvedValue(person({ invitations: [{ id: "i1", storeId: "s9", storeName: "Other Store", roleName: null, expiresAt: at, expired: false }] }));
    render(await PeoplePage({ searchParams: search({ email: "sam@example.com" }) }));
    expect(screen.getByRole("button", { name: "Cancel invitation" })).toBeInTheDocument();
  });
});

describe("/admin/admins", () => {
  it("awaits the guard before it reads the admins", async () => {
    mocks.guard.mockRejectedValue(new Error("redirect:/admin/verify"));
    await expect(AdminsPage()).rejects.toThrow("redirect:/admin/verify");
    expect(mocks.admins).not.toHaveBeenCalled();
  });

  it("shows Add by email and the admins, marking the one looking", async () => {
    render(await AdminsPage());
    expect(screen.getByRole("heading", { level: 1, name: "Admins" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add admin" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("You");
  });
});
