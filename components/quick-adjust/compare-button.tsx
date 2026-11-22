// Compare on the Published view's adjusted line (0.7.0.9 spec §4.4, §5.3): the published adjustment against its version,
// for everyone who can see the planogram.

"use client";

import { Columns2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlanogramScope } from "@/lib/planograms/types";

import { AdjustCompare, type Which } from "./adjust-compare";

export function CompareButton({ fixtureId, scope, which }: { fixtureId: string; scope: PlanogramScope; which: Which }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon variant="secondary" onClick={() => setOpen(true)} aria-label="Compare Quick Adjust">
        <Columns2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <AdjustCompare fixtureId={fixtureId} which={which} scope={scope} open={open} onOpenChange={setOpen} />
    </>
  );
}
