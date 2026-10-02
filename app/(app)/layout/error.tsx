// If the layout cannot be loaded. Next 16 passes `retry`, not `reset`
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).

"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function LayoutError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-semibold text-ink">The layout could not be loaded.</h1>
      <p className="text-sm text-ink-muted">Check your connection and try again.</p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
