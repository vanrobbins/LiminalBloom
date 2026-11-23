// "Ask Liminal Bloom" (spec 0.7.1 9.5): a link styled as a button, `LifeBuoy` and the words, to /help/new with the
// kind and the screen it came from filled in. `from` is only a hint: the server keeps it if it is on its list
// and drops it otherwise (lib/help/context.ts). The primary form is Help's own call to action; the secondary one
// goes under an empty state (A9 puts it on the screens where people get stuck).

import { LifeBuoy } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { HelpKind } from "@/lib/help/kinds";

export function AskButton({ kind, from, variant = "secondary" }: { kind?: HelpKind; from?: string; variant?: "primary" | "secondary" }) {
  const query = new URLSearchParams();
  if (kind) query.set("kind", kind);
  if (from) query.set("from", from);
  const text = query.toString();
  return (
    <Button asChild variant={variant}>
      <Link href={text ? `/help/new?${text}` : "/help/new"}>
        <LifeBuoy aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        Ask Liminal Bloom
      </Link>
    </Button>
  );
}
