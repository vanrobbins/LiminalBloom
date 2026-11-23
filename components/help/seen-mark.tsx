// Opening a thread with a reply in it marks the reply seen (spec 0.7.1 9.2), then refreshes so the avatar's dot
// and the Help count drop. Rendered only while the thread is unread, so the refresh ends it. Draws nothing.

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { markSeenAction } from "@/app/(app)/help/actions";

export function SeenMark({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    markSeenAction(id)
      .then(() => router.refresh())
      .catch(() => {
        // Seen is a courtesy: if it did not reach the server the dot simply stays until the next visit.
      });
  }, [id, router]);
  return null;
}
