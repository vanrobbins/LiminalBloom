// Catches a failed read of Home's cards so only they are replaced; the search above keeps
// working. `retry` re-fetches the server render (`reset` would not recover from it), and the
// call to action keeps its word, as /layout's error page does (0.7.0.6 spec section 6).

"use client";

import { catchError, type ErrorInfo } from "next/error";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

function CardsFallback(_props: object, { error, retry }: ErrorInfo) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-ink">Couldn&apos;t load this store&apos;s cards.</p>
      <Button variant="secondary" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}

export const CardsBoundary = catchError(CardsFallback);
