// "Ask Liminal Bloom" (spec 0.7.1 9.5): a link styled as a button, `LifeBuoy` and the words, to /help/new with the
// kind and the screen it came from filled in. `from` is only a hint: the server keeps it if it is on its list
// and drops it otherwise (lib/help/context.ts). The primary form is Help's own call to action; the secondary one
// goes under an empty state (A9 puts it on the screens where people get stuck).

import { LifeBuoy } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { HelpKind } from "@/lib/help/kinds";
import { authHref } from "@/lib/return-path";

type AskButtonProps = { kind?: HelpKind; from?: string; variant?: "primary" | "secondary"; signedOut?: boolean };

export function AskButton({ kind, from, variant = "secondary", signedOut = false }: AskButtonProps) {
  const query = new URLSearchParams();
  if (kind) query.set("kind", kind);
  if (from) query.set("from", from);
  const text = query.toString();
  const target = text ? `/help/new?${text}` : "/help/new";
  // A signed-out visitor goes through sign-in and lands on the form (the form itself needs an account).
  const href = signedOut ? authHref("/sign-in", target) : target;
  return (
    <Button asChild variant={variant}>
      <Link href={href}>
        <LifeBuoy aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        Ask Liminal Bloom
      </Link>
    </Button>
  );
}
