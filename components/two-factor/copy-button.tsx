// A Copy icon button that says it copied. Without a clipboard (or if it is refused) the person is told to
// copy by hand; the text it copies is always on screen next to it.

"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const COPIED_MS = 2000;

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setState("idle"), COPIED_MS);
  }

  const Icon = state === "copied" ? Check : Copy;
  return (
    <>
      <Button variant="secondary" icon aria-label={label} onClick={copy}>
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy. Select the text and copy it yourself." : ""}
      </span>
    </>
  );
}
