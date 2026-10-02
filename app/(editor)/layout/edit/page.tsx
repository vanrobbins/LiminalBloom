// The store map editor (spec §10), full screen with no app shell. The page
// guards itself (CODESTYLE rule 9) and hands its server actions to the
// client editor as props, so the editor never imports server code.

import { MapEditor } from "@/components/store-map/map-editor";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";

import { fetchLayout, saveLayoutChanges } from "./actions";

export const dynamic = "force-dynamic";

export default async function EditLayoutPage() {
  const { activeStoreId } = await requireMember();
  const layout = await loadLayout(activeStoreId);
  return <MapEditor storeId={activeStoreId} initialLayout={layout} save={saveLayoutChanges} fetchLatest={fetchLayout} />;
}
