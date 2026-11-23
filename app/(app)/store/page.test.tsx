import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invitationRow, person, ROLES, viewOf } from "@/components/people/test-view";
import type { PeopleView } from "@/lib/access/people-view";

const STANDALONE = [
  { id: "a", name: "Pioneer Place", companyId: null, companyName: null, regionName: null },
  { id: "b", name: "Other", companyId: null, companyName: null, regionName: null },
];
const mocks = vi.hoisted(() => ({ switches: ["view", "store.settings"] as string[], view: null as PeopleView | null, viewFor: vi.fn(), stores: [] as unknown[], company: null as unknown }));

vi.mock("@/lib/current-member", () => ({
  requireMember: async () => ({ kind: "member", user: { id: "u", name: "Van", email: "v@x.co" }, stores: mocks.stores, activeStoreId: "a", switches: mocks.switches, company: mocks.company }),
  can: (member: { switches: string[] }, wanted: string) => member.switches.includes(wanted),
}));
vi.mock("@/lib/store-settings", () => ({ storeSettingsFor: async () => ({ timezone: "America/Los_Angeles", version: 1 }) }));
vi.mock("@/lib/access/people", () => ({ peopleViewFor: async (...args: unknown[]) => (mocks.viewFor(...args), mocks.view) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({ renameStoreAction: vi.fn(), saveTimezoneAction: vi.fn() }));
vi.mock("./people-actions", () => ({ cancelInvitationAction: vi.fn(), changeRoleAction: vi.fn(), createInvitationAction: vi.fn(), removePersonAction: vi.fn() }));

import StorePage from "./page";

const STAFF = viewOf([person("Van Robbins", "r-sa", "Sales Associate", 500, { isYou: true }), person("Zoe Sales", "r-sa", "Sales Associate", 500)]);
const MANAGER = viewOf(
  [person("Van Robbins", "r-am", "Assistant Manager", 200, { isYou: true, email: "van@x.co" }), person("Zoe Sales", "r-sa", "Sales Associate", 500, { email: "zoe@x.co", canAct: true })],
  { canManage: true, assignable: ROLES, invitations: [invitationRow("new@x.co")] },
);

async function show(switches: string[], view: PeopleView) {
  mocks.switches = switches;
  mocks.view = view;
  render(await StorePage());
}

describe("StorePage", () => {
  beforeEach(() => {
    mocks.view = STAFF;
    mocks.stores = STANDALONE;
    mocks.company = null;
  });

  it("gives everyone the Store title, the details and one People list, in that order, with no back link", async () => {
    await show(["view"], STAFF);
    expect(screen.getByRole("heading", { level: 1, name: "Store" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Back to/ })).toBeNull();
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Store", "Store details", "People · 2"]);
    expect(screen.getByText("Zoe Sales")).toBeInTheDocument();
    expect(screen.getAllByText("Sales Associate")).toHaveLength(2);
  });

  it("offers Invite when the viewer may grant a role", async () => {
    await show(["view", "people.manage"], MANAGER);
    expect(screen.getByRole("button", { name: "Invite someone" })).toBeInTheDocument();
  });

  it("has no Invite for a view with nothing to grant", async () => {
    await show(["view", "people.manage"], viewOf(MANAGER.groups.flatMap((g) => g.people), { canManage: true, assignable: [] }));
    expect(screen.queryByRole("button", { name: "Invite someone" })).toBeNull();
  });

  it("links Roles and permissions to /store/roles with roles.manage", async () => {
    await show(["view", "roles.manage"], STAFF);
    expect(screen.getByRole("link", { name: "Roles and permissions" })).toHaveAttribute("href", "/store/roles");
  });

  it("has no Roles link without roles.manage", async () => {
    await show(["view", "people.manage", "store.settings"], MANAGER);
    expect(screen.queryByRole("link", { name: "Roles and permissions" })).toBeNull();
  });

  it("puts the details, then the Roles link, then the people", async () => {
    await show(["view", "roles.manage"], STAFF);
    const details = screen.getByRole("region", { name: "Store details" });
    const link = screen.getByRole("link", { name: "Roles and permissions" });
    const group = screen.getByRole("heading", { name: "People · 2" });
    expect(details.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the name and time zone fields with store.settings", async () => {
    await show(["view", "store.settings"], STAFF);
    expect(screen.getByLabelText("Store name")).toHaveValue("Pioneer Place");
    expect(screen.getByRole("button", { name: /^Time zone/ })).toBeInTheDocument();
    expect(screen.queryByText("Your role can't change these.")).toBeNull();
  });

  it("shows the name and zone as text with one reason for everyone else", async () => {
    await show(["view"], STAFF);
    const details = within(screen.getByRole("region", { name: "Store details" }));
    expect(details.queryByLabelText("Store name")).toBeNull();
    expect(details.getByText("Pioneer Place")).toBeInTheDocument();
    expect(screen.getAllByText("Your role can't change these.")).toHaveLength(1);
  });

  it("renders no address from a view without people.manage", async () => {
    await show(["view"], STAFF);
    // The gate itself is peopleViewFor's (lib/access): the page must ask it for the signed-in member's view.
    expect(mocks.viewFor).toHaveBeenCalledWith(expect.objectContaining({ kind: "member", activeStoreId: "a", switches: ["view"] }));
    expect(document.body.textContent).not.toContain("@");
  });

  it("shows every address and the invitations in a manager's view", async () => {
    await show(["view", "people.manage"], MANAGER);
    expect(screen.getByText("zoe@x.co")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Invitations waiting/ })).toBeInTheDocument();
  });

  it("says Part of the company and region, linked to /company for a company person", async () => {
    mocks.stores = [{ id: "a", name: "Pioneer Place", companyId: "c", companyName: "Acme", regionName: "North" }];
    mocks.company = { id: "c", name: "Acme", role: "regional_manager", regionId: "n", regionName: "North", switches: [] };
    await show(["view"], STAFF);
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/company");
    expect(screen.getByText(/^Part of/)).toHaveTextContent("Part of Acme · North");
  });

  it("says No Store Manager yet. under the title when nobody in the store holds it, with Invite still there", async () => {
    await show(["view", "people.manage"], viewOf(MANAGER.groups.flatMap((g) => g.people), { canManage: true, assignable: ROLES, hasStoreManager: false }));
    expect(screen.getByText("No Store Manager yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite someone" })).toBeInTheDocument();
  });

  it("lists the company's regional managers above the People list", async () => {
    await show(["view"], viewOf(STAFF.groups.flatMap((g) => g.people), { regionalManagers: [{ name: "Rhea North", email: null, isYou: false }] }));
    const heading = screen.getByRole("heading", { name: "Regional Manager · 1" });
    expect(heading.compareDocumentPosition(screen.getByRole("heading", { name: "People · 2" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Rhea North")).toBeInTheDocument();
  });
});
