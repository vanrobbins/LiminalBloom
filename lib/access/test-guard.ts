// Stands in for requireSwitchForAction in action tests that mock
// "@/lib/current-member": the same answer the real guard gives (it uses the real can()),
// for a member the test builds, so each test states exactly which switches the person holds.

import type { Member, SwitchCheck } from "@/lib/current-member";

import { can, type Holder } from "./can";
import { SWITCHES, type Switch } from "./switches";

/** A person who may do everything: for component tests that are not about permissions. */
export const EVERYTHING: Holder = { switches: [...SWITCHES] };

export function memberWith(storeId: string, switches: readonly Switch[], user = { id: "member-123", name: "Test User", email: "test@example.com" }): Member {
  return { kind: "member", user, stores: [{ id: storeId, name: "Test Store" }], activeStoreId: storeId, role: null, switches: [...switches], isPlatformAdmin: false };
}

/** `guard = () => member`: read when the action runs, so a test can change the member between calls. */
export function guardFor(current: () => Member) {
  return async (wanted: Switch): Promise<SwitchCheck> => {
    const member = current();
    return can(member, wanted) ? { status: "ok", member } : { status: "forbidden" };
  };
}
