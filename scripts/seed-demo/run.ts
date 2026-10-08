// The seed, start to finish (spec §6). Images go up before the database
// changes and old ones come down after, so a failure at any point leaves a
// working demo: at worst some unused files, which the next run removes.

import { DEMO_EMAIL, DEMO_STORE, createDemoStore, findDemoStore } from "./target";

type Options = { isProduction: boolean; confirm: (message: string) => Promise<boolean> };

export async function seedDemo({ isProduction, confirm }: Options): Promise<void> {
  const where = isProduction ? "PRODUCTION" : "development";
  let found = await findDemoStore();
  if (!found) {
    if (isProduction) {
      throw new Error(`No store "${DEMO_STORE}" owned by ${DEMO_EMAIL} on production. Sign up that account on the live site, create the store, then run this again.`);
    }
    console.log(`Creating ${DEMO_EMAIL} and "${DEMO_STORE}" on development…`);
    await createDemoStore();
    found = await findDemoStore();
    if (!found) throw new Error("The demo store was created but can't be found.");
  }

  console.log(`${where} · store "${DEMO_STORE}" (owner ${DEMO_EMAIL}) · ${found.productCount} products now`);
  if (isProduction && !(await confirm('Everything in this store will be replaced. Type "seed production" to go on: '))) {
    console.log("Stopped. Nothing changed.");
    return;
  }

  const { withStore } = await import("@/lib/db/with-store");
  const { deleteImagesQuietly, imageExists, listImages, putImage } = await import("@/lib/products/images");
  const { buildDemo, demoStatements } = await import("./build");

  const plan = buildDemo(found.storeId);
  let uploaded = 0;
  for (const [path, svg] of plan.images) {
    if (await imageExists(path)) continue;
    await putImage(path, svg, "image/svg+xml");
    uploaded++;
  }
  console.log(`Images: ${uploaded} uploaded, ${plan.images.size - uploaded} already there.`);

  await withStore(found.storeId, demoStatements(found.storeId, plan));

  // Every unreferenced file in the demo store goes, users' uploads included, on purpose: a reseed replaces every product.
  const keep = new Set(plan.images.keys());
  const stale = (await listImages(`stores/${found.storeId}/products/`)).filter((path) => !keep.has(path));
  await deleteImagesQuietly(stale);

  const floor = plan.locations.filter((l) => l.faceId).length;
  console.log(`Done: ${plan.products.length} products, ${plan.categories.length} categories, ${floor} floor places, ${plan.locations.length - floor} bin places, ${stale.length} old images removed.`);
}
