// What a help request carries about the asker (spec 0.7.1 9.2): built here, on the server, from who the
// session says they are, never from the form. The one thing a form may name is `from`, and only a path on
// a fixed list. Pure.

import type { CurrentMember } from "@/lib/current-member";

/** The screens that send people to Ask Liminal Bloom (spec 9.5). */
export const FROM_PATHS = ["/no-access", "/paused", "/welcome", "/invite", "/company", "/request-company"] as const;

export function cleanFrom(raw: unknown): string | null {
  return typeof raw === "string" && (FROM_PATHS as readonly string[]).includes(raw) ? raw : null;
}

export type HelpContext = {
  state: Exclude<CurrentMember["kind"], "signed-out">;
  store?: { id: string; name: string };
  role?: string;
  pausedStores?: { id: string; name: string }[];
  from?: string;
};

/** The company and its role join this in 0.7.1b. */
export function buildContext(current: Exclude<CurrentMember, { kind: "signed-out" }>, rawFrom: unknown): HelpContext {
  const from = cleanFrom(rawFrom);
  const base: HelpContext = { state: current.kind };
  if (current.kind === "member") {
    const store = current.stores.find((s) => s.id === current.activeStoreId);
    if (store) base.store = { id: store.id, name: store.name };
    if (current.role) base.role = current.role.name;
  }
  if (current.kind === "needs-two-factor") base.role = current.roleName;
  if (current.kind === "paused") base.pausedStores = current.stores.map((s) => ({ id: s.id, name: s.name }));
  return from ? { ...base, from } : base;
}
