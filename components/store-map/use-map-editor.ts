// The map editor's state and its saving (spec §9). The session reducer holds
// the layout; this hook sends changes to the server one request at a time,
// rebases on every reply, retries when offline, and stops cleanly when the
// person is signed out or switched stores in another tab.

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { applyChanges, changeCount, changeIds, type ChangeSet } from "@/lib/layout/diff";
import { MAX_CHANGES_PER_SAVE } from "@/lib/layout/limits";
import type { FetchReply, SaveReply } from "@/lib/layout/replies";
import { SAVE_DELAY_MS, begin, createQueue, failed, hasPending, type Queue } from "@/lib/layout/save-queue";
import { createReducer } from "@/lib/layout/session";
import { createSession } from "@/lib/layout/session-core";
import type { Layout } from "@/lib/layout/types";
import { toast } from "@/lib/toast";

import { useEditorSync } from "./use-editor-sync";

export type SaveStatus = "saved" | "saving" | "offline";

type Options = {
  storeId: string;
  initial: Layout;
  save: (storeId: string, changes: ChangeSet) => Promise<SaveReply>;
  fetchLatest: (storeId: string) => Promise<FetchReply>;
  /** Done, once everything is saved. Unset, it goes to /layout (the full-screen editor). */
  onLeft?: () => void;
};

const RELOADED = "Couldn't save that change. The layout was reloaded.";
const TOO_MANY = "Too many changes to save at once.";
const TOO_MANY_HOW = "Nothing is lost yet. Undo some changes so the rest can save, then Redo them.";

export function useMapEditor({ storeId, initial, save, fetchLatest, onLeft }: Options) {
  const router = useRouter();
  const reduce = useMemo(() => createReducer(() => crypto.randomUUID()), []);
  const [session, dispatch] = useReducer(reduce, initial, (layout) => createSession(layout, false));

  // State for render; the ref for async callbacks. Only setQueue writes either.
  const [queue, setQueueState] = useState(() => createQueue(initial));
  const queueRef = useRef(queue);
  const setQueue = useCallback((next: Queue) => {
    queueRef.current = next;
    setQueueState(next);
  }, []);

  const [offline, setOffline] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const latest = useRef(session.layout);
  const stopped = useRef(false);
  const retry = useRef<number | undefined>(undefined);
  const reload = useRef<number | undefined>(undefined);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const invalidInARow = useRef(0);
  const tooMany = useRef(false);

  useEffect(() => {
    latest.current = session.layout;
  }, [session.layout]);

  const stop = useCallback((title: string, description: string) => {
    stopped.current = true;
    setQueue({ ...queueRef.current, inFlight: null });
    toast({ tone: "error", title, description });
  }, [setQueue]);

  const handleReply = useCallback(
    (reply: SaveReply, request: ChangeSet) => {
      const confirmed = queueRef.current.confirmed;
      switch (reply.status) {
        case "saved":
          invalidInARow.current = 0;
          dispatch({
            type: "rebase",
            base: applyChanges(confirmed, request),
            server: reply.layout,
            skip: [],
            sent: changeIds(request),
          });
          setQueue(createQueue(reply.layout));
          return;
        case "conflict":
          dispatch({ type: "rebase", base: confirmed, server: reply.layout, skip: reply.conflicts });
          setQueue(createQueue(reply.layout));
          return;
        case "invalid": {
          // The editor's own check should have caught this: worth a look.
          console.error("The server refused a layout save.", reply);
          invalidInARow.current++;
          const sent = new Set(changeIds(request));
          const blockers = reply.issues.flatMap((issue) => (issue.blockerId && sent.has(issue.blockerId) ? [issue.blockerId] : []));
          const named = reply.issues.some((issue) => sent.has(issue.itemId)) || blockers.length > 0;
          // Once, and only when it names something we sent, roll back just those items and keep the
          // rest. Otherwise skipping cannot clear it and the same save would loop: reload (spec §9).
          if (invalidInARow.current === 1 && named) {
            const skip = [...reply.issues.map((issue) => issue.itemId), ...blockers];
            dispatch({ type: "rebase", base: confirmed, server: reply.layout, skip, notice: reply.issues[0].message });
          } else {
            dispatch({ type: "replace", layout: reply.layout, notice: RELOADED });
          }
          setQueue(createQueue(reply.layout));
          return;
        }
        case "rejected":
          // The editor's own check should have caught this: worth a look.
          console.error("The server refused a layout save.", reply);
          dispatch({ type: "replace", layout: reply.layout, notice: RELOADED });
          setQueue(createQueue(reply.layout));
          return;
        case "signed-out":
          stop("You were signed out.", "Your last change was not saved. Sign in to keep editing.");
          router.push("/sign-in");
          return;
        case "store-changed":
          stop("You switched stores in another tab.", "Reloading, so nothing lands in the wrong store.");
          // Long enough to read the message first.
          reload.current = window.setTimeout(() => window.location.reload(), 1500);
          return;
      }
    },
    [router, setQueue, stop],
  );

  const saveNow = useCallback(async () => {
    if (stopped.current) return;
    const started = begin(queueRef.current, latest.current);
    if (!started) {
      // A retry that finds nothing to send (undone, or rebased away) must not leave us "offline" for good.
      window.clearTimeout(retry.current);
      setOffline(false);
      return;
    }
    // The server refuses an oversize save outright, and a reload would throw the changes away (B1).
    // Hold them instead, once say how to get under the cap, and let Done be pressed again later.
    if (changeCount(started.request) > MAX_CHANGES_PER_SAVE) {
      if (!tooMany.current) toast({ tone: "error", title: TOO_MANY, description: TOO_MANY_HOW });
      tooMany.current = true;
      setLeaving(false);
      return;
    }
    tooMany.current = false;
    setQueue(started.queue);
    let reply: SaveReply;
    try {
      reply = await save(storeId, started.request);
    } catch {
      const result = failed(queueRef.current);
      setQueue(result.queue);
      setOffline(true);
      window.clearTimeout(retry.current);
      retry.current = window.setTimeout(() => void saveRef.current(), result.retryInMs);
      return;
    }
    setOffline(false);
    handleReply(reply, started.request);
  }, [handleReply, save, setQueue, storeId]);

  useEffect(() => {
    saveRef.current = saveNow;
  }, [saveNow]);

  const pending = hasPending(queue, session.layout);

  // Save a moment after the last committed change (spec §9). While offline, the retry timer drives it.
  useEffect(() => {
    if (!pending || queue.inFlight || offline) return;
    const timer = window.setTimeout(() => void saveNow(), leaving ? 0 : SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending, queue, offline, leaving, saveNow, session.layout]);

  // Done waits for the queue to empty.
  useEffect(() => {
    if (!leaving || pending) return;
    if (onLeft) onLeft();
    else router.push("/layout");
  }, [leaving, pending, router, onLeft]);

  useEditorSync({ storeId, notice: session.notice, dispatch, fetchLatest, queueRef, setQueue, latest, stopped });

  useEffect(
    () => () => {
      window.clearTimeout(retry.current);
      window.clearTimeout(reload.current);
    },
    [],
  );

  const status: SaveStatus = offline ? "offline" : pending ? "saving" : "saved";
  const done = useCallback(() => setLeaving(true), []);
  return { session, dispatch, status, leaving, done };
}
