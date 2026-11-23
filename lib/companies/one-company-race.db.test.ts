// The one-company rule when two grants for the same person run at once (spec 0.7.1 5.4), against the dev database.
// Each grant is one batch that takes a per-person advisory lock first (one-company.ts), so of two grants into
// different companies exactly one wins and the person ends in one company. Run several rounds: the interleaving is
// not forced, but without the lock these pairs pass each other's checks often enough to fail.

import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation } from "@/db/auth-schema";
import { companies, companyRequests, roleAssignments } from "@/db/schema";
import { cleanUp, makeActor } from "@/lib/access/test-admin-actions";
import { acceptInvitation } from "@/lib/access/invitation-accept";
import { dropPeople, makeInvitation, makePerson } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { approveRequest } from "./approve";
import { createCompanyInvitation } from "./invite";
import { acceptCompanyInvitation } from "./invite-accept";
import { sendRequest } from "./request";
import { dropCompanies, emailOf, makeBareAccount, makeCompanyStore, makeStaffedCompany } from "./test-companies";

const REASON = "db test: one-company race";
const owned: string[] = [];
afterAll(async () => {
  if (owned.length > 0) await db.delete(companies).where(inArray(companies.ownerUserId, owned));
  await dropStores();
  await dropCompanies();
  await dropPeople();
  await cleanUp([REASON]);
});

const ROUNDS = 4;
type Co = Awaited<ReturnType<typeof makeStaffedCompany>>;
const who = async (id: string) => ({ id, name: "Race Person", email: await emailOf(id) });

async function companyInvite(s: Co, to: string) {
  const made = await createCompanyInvitation(s.company.id, { userId: s.owner, name: "Owner", role: "owner" }, await emailOf(to), "corporate_admin", null);
  if (made.status !== "created") throw new Error(`not created: ${made.status}`);
  return made.id;
}
async function storeInvite(s: Co, to: string) {
  const store = await makeCompanyStore(s.company.id, null, `race-${randomUUID().slice(0, 6)}`);
  const id = await makeInvitation(store.store, (await makePerson(store.store, store.roles.store_manager)).userId, store.roles.vm_worker);
  await db.update(invitation).set({ email: await emailOf(to) }).where(eq(invitation.id, id));
  return id;
}
/** How many companies the person ended up in: a role row, a member row of a company store, or an owned company. */
async function companiesOf(id: string): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql_count(id));
  return Number(rows.rows[0].n);
}
const sql_count = (id: string) => sql`select count(distinct c) as n from (
  select company_id as c from role_assignments where user_id = ${id}
  union all select owner_user_id as c from companies where owner_user_id = ${id}
  union all select sp.company_id from member m join store_profiles sp on sp.store_id = m.organization_id where m.user_id = ${id}) x`;
const accepted = (r: { status: string } | null) => r?.status === "accepted";

describe("one-company rule under concurrent grants", { timeout: 120_000 }, () => {
  it("lets one of two company invitations from different companies win", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const [a, b] = [await makeStaffedCompany(`rc-a${i}`), await makeStaffedCompany(`rc-b${i}`)];
      const p = await makeBareAccount("rc-p");
      const [ia, ib] = [await companyInvite(a, p), await companyInvite(b, p)];
      const out = await Promise.all([acceptCompanyInvitation(await who(p), ia), acceptCompanyInvitation(await who(p), ib)]);
      expect(out.filter(accepted)).toHaveLength(1);
      expect(await companiesOf(p)).toBe(1);
    }
  });

  it("lets one of a company invitation and a store invitation into another company win", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const [a, b] = [await makeStaffedCompany(`rs-a${i}`), await makeStaffedCompany(`rs-b${i}`)];
      const p = await makeBareAccount("rs-p");
      const [ia, ib] = [await companyInvite(a, p), await storeInvite(b, p)];
      const out = await Promise.all([acceptCompanyInvitation(await who(p), ia), acceptInvitation(await who(p), ib)]);
      expect(out.filter(accepted)).toHaveLength(1);
      expect(await companiesOf(p)).toBe(1);
    }
  });

  it("lets one of two store invitations into different companies' stores win", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const [a, b] = [await makeStaffedCompany(`ss-a${i}`), await makeStaffedCompany(`ss-b${i}`)];
      const p = await makeBareAccount("ss-p");
      const [ia, ib] = [await storeInvite(a, p), await storeInvite(b, p)];
      const out = await Promise.all([acceptInvitation(await who(p), ia), acceptInvitation(await who(p), ib)]);
      expect(out.filter(accepted)).toHaveLength(1);
      expect(await companiesOf(p)).toBe(1);
    }
  });

  it("lets one of an approval and a company invitation win, never both", async () => {
    const admin = await makeActor();
    for (let i = 0; i < ROUNDS; i++) {
      const a = await makeStaffedCompany(`ap-a${i}`);
      const p = await makeBareAccount("ap-p");
      owned.push(p);
      const sent = await sendRequest(p, `Race ${randomUUID().slice(0, 8)}`);
      if (sent.status !== "done") throw new Error(`not sent: ${sent.status}`);
      const ia = await companyInvite(a, p);
      const [req] = await db.select().from(companyRequests).where(eq(companyRequests.id, sent.id));
      await Promise.all([approveRequest(admin, { id: sent.id, version: req.version }, REASON), acceptCompanyInvitation(await who(p), ia)]);
      expect(await companiesOf(p)).toBe(1);
      expect((await db.select().from(roleAssignments).where(eq(roleAssignments.userId, p))).length + (await db.select().from(companies).where(eq(companies.ownerUserId, p))).length).toBe(1);
    }
  });
});
