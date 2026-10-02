// If the editor cannot be opened. Mirrors app/(app)/layout/error.tsx, but
// full screen, as the editor has no app shell around it. Next 16 passes
// `retry`, not `reset`
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).

"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function EditorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh items-center justify-center bg-surface p-4">
      <div role="alert" className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-ink">The layout editor could not be opened.</h1>
        <p className="text-sm text-ink-muted">Check your connection and try again.</p>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </main>
  );
}
