// A help action's button and its dialog (spec 0.7.1 7.4): an icon and a word, because an admin screen has few
// buttons and a mistaken one is costly. The dialog mounts only while open, so each opening starts blank.

"use client";

import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Button, type ButtonVariant } from "@/components/ui/button";

import { ReasonDialog, type ReasonDialogProps } from "./reason-dialog";

type Props = Omit<ReasonDialogProps, "onClose"> & {
  label: string;
  icon: LucideIcon;
  buttonVariant?: ButtonVariant;
};

export function AdminAction({ label, icon: Icon, buttonVariant = "secondary", ...dialog }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={buttonVariant} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        {label}
      </Button>
      {open ? <ReasonDialog {...dialog} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
