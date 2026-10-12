// The planogram's actions (spec §4.4): Start draft, or Add product · Publish…
// with Discard draft behind ⋯ so it never sits beside Publish. On a phone a
// sticky bar above the tabs; inline on tablet and desktop.

"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { discardDraftAction, startDraftAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PlanogramRow } from "@/lib/planograms/queries";
import { toast } from "@/lib/toast";

import { PublishDialog } from "./publish-dialog";

type DraftBarProps = { fixtureId: string; row: PlanogramRow | null; hasDraft: boolean; isEditing: boolean; draftVersion: number | null; latestNumber: number | null; onAdd: () => void };

export function DraftBar({ fixtureId, row, hasDraft, isEditing, draftVersion, latestNumber, onAdd }: DraftBarProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"start" | "discard" | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  async function start() {
    setBusy("start");
    try {
      const reply = await startDraftAction(fixtureId, row?.version ?? null);
      if (reply.status === "refused") toast({ tone: "error", title: reply.message });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't start the draft", description: "Check the connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    setBusy("discard");
    try {
      const reply = await discardDraftAction(fixtureId, draftVersion ?? row?.version ?? 0);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      setDiscarding(false);
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't discard", description: "Check the connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  if (hasDraft && !isEditing) return null;

  return (
    <>
      <div data-action-bar className="fixed inset-x-0 bottom-14 z-20 border-t border-line-subtle bg-raised px-4 py-2 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-lg items-center gap-2 md:mx-0 md:max-w-none">
          {!hasDraft ? (
            <>
              <Button className="flex-1 md:flex-none" onClick={start} loading={busy === "start"} loadingText="Starting…">
                Start draft
              </Button>
              <p className="hidden text-sm text-ink-muted md:block">{latestNumber ? `From version ${latestNumber}.` : "From what's on the floor now."}</p>
            </>
          ) : (
            <>
              <Button variant="secondary" className="flex-1 md:flex-none" onClick={onAdd}>
                Add product
              </Button>
              <Button className="flex-1 md:flex-none" onClick={() => setPublishing(true)}>
                Publish…
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="More draft actions" className="inline-flex size-11 shrink-0 items-center justify-center rounded border border-line bg-raised text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                  <MoreHorizontal aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end">
                  <DropdownMenuItem onSelect={() => setDiscarding(true)}>
                    <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    Discard draft…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      {/* Keeps the last card clear of the sticky bar on a phone. */}
      <div aria-hidden="true" className="h-16 md:hidden" />
      <PublishDialog open={publishing} onOpenChange={setPublishing} fixtureId={fixtureId} />
      <Dialog open={discarding} onOpenChange={setDiscarding} title="Discard this draft?" description="Every change since it started is lost. The published planogram stays as it is.">
        <Button variant="danger" onClick={discard} loading={busy === "discard"} loadingText="Discarding…">
          Discard draft
        </Button>
      </Dialog>
    </>
  );
}
