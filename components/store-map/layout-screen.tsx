// /layout's body (spec §10, DECISIONS 11-09 A3): the read-only map, and the
// editor in the same area. + Add (or Edit) swaps the viewer for the editor in
// place, + Add with its panel already open; Done saves, swaps back and
// reloads the layout. /layout/edit stays as the full-screen editor.

"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import type { ChangeSet } from "@/lib/layout/diff";
import type { FetchReply, SaveReply } from "@/lib/layout/replies";
import type { Layout } from "@/lib/layout/types";
import type { FloorPlanogram, ProductLook } from "@/lib/planograms/types";

import { MapEditor } from "./map-editor";
import { MapViewer } from "./map-viewer";

type LayoutScreenProps = {
  storeId: string;
  layout: Layout;
  planograms: Readonly<Record<string, FloorPlanogram>>;
  looks: Readonly<Record<string, ProductLook>>;
  save: (storeId: string, changes: ChangeSet) => Promise<SaveReply>;
  fetchLatest: (storeId: string) => Promise<FetchReply>;
};

/** Changes whenever the loaded layout does, so the viewer starts over from it after editing. */
function layoutKey(layout: Layout): string {
  const text = JSON.stringify(layout);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

export function LayoutScreen({ storeId, layout, planograms, looks, save, fetchLatest }: LayoutScreenProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ withAdd: boolean } | null>(null);
  const key = useMemo(() => layoutKey(layout), [layout]);

  if (editing) {
    return (
      // Fills <main> edge to edge (it pads px-4 pt-6 on a phone, px-8 py-10 above), clear of the phone tabs.
      <div data-embedded-editor className="-mx-4 -mt-6 -mb-28 h-[calc(100dvh-3.5rem)] md:-mx-8 md:-my-10 md:h-dvh">
        <MapEditor
          storeId={storeId}
          initialLayout={layout}
          save={save}
          fetchLatest={fetchLatest}
          embedded
          startWithAdd={editing.withAdd}
          onLeft={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Store layout"
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing({ withAdd: false })}>
              <Pencil aria-hidden="true" strokeWidth={1.75} className="size-4" />
              Edit
            </Button>
            <Button onClick={() => setEditing({ withAdd: true })}>
              <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
              Add
            </Button>
          </>
        }
      />
      <MapViewer key={key} layout={layout} planograms={planograms} looks={looks} storeKey={storeId} />
    </>
  );
}
