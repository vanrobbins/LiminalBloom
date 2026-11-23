// Compare, and Publish for a draft, on a planogram's Quick Adjust lines (0.7.0.9 spec §4.4, §4.5, §5.3). On the
// published line it compares the Quick Adjust on the floor, for everyone who can see the planogram. On the draft
// line it compares the draft, and with `publishing` opens the same dialog with its confirm, for a publisher who may
// not draft (there is no adjust page for them). A publish that went through refreshes the page.

"use client";

import { Columns2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlanogramScope } from "@/lib/planograms/types";

import { AdjustCompare, type Which } from "./adjust-compare";

type CompareButtonProps = { fixtureId: string; scope: PlanogramScope; which: Which; publishing?: boolean };

export function CompareButton({ fixtureId, scope, which, publishing = false }: CompareButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const Icon = publishing ? Send : Columns2;
  const label = publishing ? "Publish Quick Adjust draft" : which === "draft" ? "Compare Quick Adjust draft" : "Compare Quick Adjust";
  return (
    <>
      <Button icon variant={publishing ? "primary" : "secondary"} onClick={() => setOpen(true)} aria-label={label}>
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <AdjustCompare fixtureId={fixtureId} which={which} scope={scope} open={open} onOpenChange={setOpen} publishing={publishing} onPublished={() => router.refresh()} />
    </>
  );
}
