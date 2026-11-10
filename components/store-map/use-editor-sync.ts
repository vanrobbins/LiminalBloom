// Keeping the map editor in step with the browser (spec §9): the session's
// messages become toasts, closing the tab with unsaved changes asks first, and
// coming back to the tab picks up other devices' edits.

"use client";

import { useEffect, type Dispatch, type RefObject } from "react";

import type { FetchReply } from "@/lib/layout/replies";
import { createQueue, hasPending, type Queue } from "@/lib/layout/save-queue";
import type { SessionAction } from "@/lib/layout/session";
import type { Layout } from "@/lib/layout/types";
import { toast } from "@/lib/toast";

type Options = {
  storeId: string;
  notice: string | null;
  dispatch: Dispatch<SessionAction>;
  fetchLatest: (storeId: string) => Promise<FetchReply>;
  queueRef: RefObject<Queue>;
  setQueue: (next: Queue) => void;
  latest: RefObject<Layout>;
  stopped: RefObject<boolean>;
};

export function useEditorSync({ storeId, notice, dispatch, fetchLatest, queueRef, setQueue, latest, stopped }: Options) {
  // Messages from the session (a blocked drop, a conflict) become toasts.
  useEffect(() => {
    if (!notice) return;
    toast({ tone: "error", title: notice });
    const clear = window.setTimeout(() => dispatch({ type: "noticeShown" }), 0);
    return () => window.clearTimeout(clear);
  }, [notice, dispatch]);

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      // Once stopped, the reload that follows must not be blocked by our own prompt.
      if (!stopped.current && hasPending(queueRef.current, latest.current)) event.preventDefault();
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [latest, queueRef, stopped]);

  // Coming back to the tab: pick up other devices' edits when nothing is pending here.
  useEffect(() => {
    async function onFocus() {
      if (stopped.current || hasPending(queueRef.current, latest.current)) return;
      let reply: FetchReply;
      try {
        reply = await fetchLatest(storeId);
      } catch {
        return; // offline: the next focus tries again
      }
      if (reply.status !== "ok") return;
      // An edit or save may have started during the fetch; the save's own reply will rebase.
      if (stopped.current || queueRef.current.inFlight || hasPending(queueRef.current, latest.current)) return;
      dispatch({ type: "rebase", base: queueRef.current.confirmed, server: reply.layout, skip: [] });
      setQueue(createQueue(reply.layout));
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dispatch, fetchLatest, latest, queueRef, setQueue, stopped, storeId]);
}
