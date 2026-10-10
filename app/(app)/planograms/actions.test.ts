import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import * as currentMember from "@/lib/current-member";
import { addProduct } from "@/lib/planograms/test-planograms";
import { dropStores, makeStore, seedStoreFixtures, type StoreFixtures } from "@/lib/products/test-stores";

import { pickerSearch, previewPublishAction, publishAction, restoreAction, saveChangeAction, startDraftAction } from "./actions";

vi.mock("@/lib/current-member");
// publishedBy is a real foreign key, so the signed-in member must be a real user row.
const VAN = { id: `test_pg_actions_${randomUUID().slice(0, 8)}`, name: "Van", email: "van@example.com" };
beforeAll(async () => {
  await db.insert(user).values({ ...VAN, email: `${VAN.id}@example.com` });
});
afterAll(async () => {
  await dropStores();
  await db.delete(user).where(eq(user.id, VAN.id));
});

describe("planogram actions", () => {
  let store: string;
  let f: StoreFixtures;
  let tee: string;

  beforeEach(async () => {
    store = await makeStore(`pg-actions-${randomUUID().slice(0, 6)}`);
    vi.mocked(currentMember.requireMember).mockResolvedValue({
      kind: "member",
      user: VAN,
      stores: [{ id: store, name: "Test Store" }],
      activeStoreId: store,
    });
    f = await seedStoreFixtures(store);
    tee = await addProduct(store, f.categoryId, "Pocket Tee");
    await startDraftAction(f.fixtureId, null);
  });

  const add = (productId: string, col: number) =>
    saveChangeAction(f.fixtureId, { kind: "add", productId, fields: { faceId: f.faceId, presentation: "hung", col, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 1 } });

  it("refuses malformed input without touching the draft", async () => {
    expect(await saveChangeAction(f.fixtureId, { kind: "add", productId: "nope" })).toMatchObject({ status: "refused" });
    expect(await saveChangeAction("not-a-uuid", { kind: "remove", id: randomUUID(), version: 1 })).toMatchObject({ status: "refused" });
  });

  it("returns the whole draft, so each device sees the other's edits", async () => {
    await add(tee, 3); // device A
    const reply = await add(f.productId, 5); // device B
    expect(reply.status).toBe("saved");
    if (reply.status === "saved") expect(reply.draft.placements.map((p) => p.productName).sort()).toEqual(["High-Rise Pant", "High-Rise Pant", "Pocket Tee"]);
  });

  it("names the rule a refused change broke, with the current draft", async () => {
    const reply = await add(tee, 0);
    expect(reply).toMatchObject({ status: "refused", message: "Blocked by High-Rise Pant" });
    if (reply.status === "refused") expect(reply.draft?.placements).toHaveLength(1);
  });

  it("publishes with a toast message, then refuses a stale publish in words", async () => {
    const preview = await previewPublishAction(f.fixtureId);
    expect(await publishAction(f.fixtureId, preview?.planogramVersion ?? 0, null, " First ")).toEqual({ status: "saved", message: "Version 1 published" });
    expect(await publishAction(f.fixtureId, preview?.planogramVersion ?? 0, null, "")).toEqual({
      status: "refused",
      message: "Version 1 was published while you were editing — review the changes",
    });
  });

  it("restores with a message naming what was skipped", async () => {
    const preview = await previewPublishAction(f.fixtureId);
    await publishAction(f.fixtureId, preview?.planogramVersion ?? 0, null, "");
    const reply = await restoreAction(f.fixtureId, (preview?.planogramVersion ?? 0) + 1, 1);
    expect(reply).toEqual({ status: "saved", message: "Restored version 1 as a draft." });
  });

  it("finds products with both footprints for the add form", async () => {
    const found = await pickerSearch("pocket tee");
    expect(found[0]).toMatchObject({ name: "Pocket Tee", footprints: { folded: { columns: 2, rows: 2, stackLimit: 8 } } });
  });
});
