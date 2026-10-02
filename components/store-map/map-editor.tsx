// The map editor (spec §10): one canvas, panels by screen size, everything
// driven through the session reducer. This file only arranges parts; the
// rules live in lib/layout/.

"use client";

import { useCallback, useMemo, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { screenToWorld } from "@/lib/layout/camera";
import type { ChangeSet } from "@/lib/layout/diff";
import { canRedo, canUndo } from "@/lib/layout/history";
import { OVERVIEW, handlesFor, hitTest, isDraggable } from "@/lib/layout/hit-test";
import { previewCorner } from "@/lib/layout/outline-draw";
import type { FetchReply, SaveReply } from "@/lib/layout/replies";
import type { AddKind } from "@/lib/layout/session-core";
import type { Layout } from "@/lib/layout/types";
import { validate } from "@/lib/layout/validate";

import { AddMenu } from "./add-menu";
import { TILE_TYPE } from "./add-options";
import { AddSheet } from "./add-sheet";
import { DrawingBar } from "./drawing-bar";
import { EditorBottomBar } from "./editor-bottom-bar";
import { EditorTopBar } from "./editor-top-bar";
import { LayoutList } from "./layout-list";
import { OutlineSetup } from "./outline-setup";
import { PropertiesPanel } from "./properties-panel";
import { StoreMap } from "./store-map";
import { TypeTiles } from "./type-tiles";
import { useEditorKeys } from "./use-editor-keys";
import { useElementSize } from "./use-element-size";
import { useMapEditor } from "./use-map-editor";
import { PHONE_QUERY, useMediaQuery } from "./use-media-query";
import { usePointerInput } from "./use-pointer-input";
import { ZoomControls } from "./zoom-controls";

type MapEditorProps = {
  storeId: string;
  initialLayout: Layout;
  save: (storeId: string, changes: ChangeSet) => Promise<SaveReply>;
  fetchLatest: (storeId: string) => Promise<FetchReply>;
};

const ADD_KINDS: readonly string[] = ["zone", "entrance", "table", "wall_bay", "rack", "mannequin", "platform", "prop"];

export function MapEditor({ storeId, initialLayout, save, fetchLatest }: MapEditorProps) {
  const { session, dispatch, status, leaving, done } = useMapEditor({ storeId, initial: initialLayout, save, fetchLatest });
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [listOpen, setListOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const onSize = useCallback((viewport: { width: number; height: number }) => dispatch({ type: "viewport", viewport }), [dispatch]);
  const container = useElementSize<HTMLDivElement>(onSize);

  // What is on screen: the drag preview while dragging, else the layout.
  const shown = session.preview?.layout ?? session.layout;
  const handles = session.drag ? [] : handlesFor(session.layout, session.selection, session.camera);
  const layoutIssues = useMemo(() => validate(session.layout), [session.layout]);
  const issues = session.preview?.issues ?? layoutIssues;

  const pointer = usePointerInput({
    hit: (screen, shift) => {
      const target = hitTest(session.layout, session.focus, session.camera, screen, handles, true);
      // Shift-drag on empty space draws a selection box (desktop).
      return shift && target.kind === "empty" ? { kind: "marquee" } : target;
    },
    canDrag: isDraggable,
    onEffect: (effect) => dispatch({ type: "gesture", effect }),
    onWheel: ({ screen, dx, dy, zoom }) =>
      dispatch(zoom ? { type: "zoom", factor: Math.exp(-dy * 0.01), at: screen } : { type: "pan", dx: -dx, dy: -dy }),
    onHover: (screen) => {
      if (session.drawing) dispatch({ type: "drawPointer", at: screenToWorld(session.camera, screen) });
    },
  });
  useEditorKeys(dispatch, pointer.reset);

  const add = (kind: AddKind) => dispatch({ type: "add", kind });
  const focus = session.focus;
  const zone = focus.kind === "zone" ? session.layout.zones.find((z) => z.id === focus.id) : undefined;
  const drawPreview = session.drawing && session.pointer ? previewCorner(session.drawing, session.pointer, session.camera.scale).point : null;
  const list = <LayoutList layout={session.layout} selection={session.selection} issues={issues} dispatch={dispatch} />;
  const properties = <PropertiesPanel session={session} dispatch={dispatch} />;

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <EditorTopBar
        title={zone?.name ?? "Store layout"}
        inZone={zone !== undefined}
        status={status}
        leaving={leaving}
        canUndo={canUndo(session.history)}
        canRedo={canRedo(session.history)}
        onDone={done}
        onLeaveZone={() => dispatch({ type: "focus", focus: OVERVIEW })}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-r border-line-subtle bg-raised lg:block">
          {list}
          <TypeTiles focus={focus} onAdd={add} />
        </aside>
        <main
          ref={container}
          className="relative min-w-0 flex-1 overflow-hidden"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(TILE_TYPE)) event.preventDefault();
          }}
          onDrop={(event) => {
            const kind = event.dataTransfer.getData(TILE_TYPE);
            if (!ADD_KINDS.includes(kind)) return;
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();
            const at = screenToWorld(session.camera, { x: event.clientX - box.left, y: event.clientY - box.top });
            dispatch({ type: "add", kind: kind as AddKind, at });
          }}
        >
          <StoreMap
            layout={shown}
            camera={session.camera}
            viewport={session.viewport}
            focus={focus}
            selection={session.selection}
            vertex={session.vertex}
            issues={issues}
            guides={session.preview?.guides ?? []}
            handles={handles}
            drawing={session.drawing}
            drawPreview={drawPreview}
            marquee={session.marquee}
            svgProps={pointer.handlers}
          />
          <ZoomControls onZoom={(factor) => dispatch({ type: "zoom", factor })} onFit={() => dispatch({ type: "fit" })} />
          <div className="absolute bottom-3 left-3 hidden md:block lg:hidden">
            <AddMenu focus={focus} onAdd={add} />
          </div>
          {session.drawing ? (
            <DrawingBar
              corners={session.drawing.points.length}
              onUndo={() => dispatch({ type: "undoCorner" })}
              onCancel={() => dispatch({ type: "cancelDrawing" })}
            />
          ) : null}
        </main>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line-subtle bg-raised p-4 md:block lg:w-[300px]">
          {session.selection.length > 0 ? (
            properties
          ) : (
            <>
              <div className="lg:hidden">{list}</div>
              <p className="hidden text-sm text-ink-muted lg:block">Select something to see its properties.</p>
            </>
          )}
        </aside>
      </div>
      <EditorBottomBar status={status} onList={() => setListOpen(true)} onAdd={() => setAddOpen(true)} />

      {isPhone ? (
        <>
          <BottomSheet
            peek
            open={session.selection.length > 0 && !listOpen}
            onOpenChange={(open) => {
              if (!open) dispatch({ type: "select", ids: [] });
            }}
            title="Selected"
            hideTitle
          >
            {properties}
          </BottomSheet>
          <BottomSheet open={listOpen} onOpenChange={setListOpen} title="Everything on the map">
            {/* Choosing an item closes the sheet, so its properties can show. */}
            <LayoutList
              layout={session.layout}
              selection={session.selection}
              issues={issues}
              dispatch={(action) => {
                dispatch(action);
                if (action.type === "reveal") setListOpen(false);
              }}
            />
          </BottomSheet>
          <AddSheet open={addOpen} onOpenChange={setAddOpen} focus={focus} onAdd={add} />
        </>
      ) : null}

      {!session.layout.outline && !session.drawing ? <OutlineSetup dispatch={dispatch} /> : null}
    </div>
  );
}
