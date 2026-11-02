// The time zone's form on Store settings: the picker and Save. The page
// reloads after a save so every "today" on it follows the new zone.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TimezonePicker } from "@/components/time/timezone-picker";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

import { saveTimezoneAction } from "./actions";

export function TimezoneForm({ zone, version }: { zone: string; version: number }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function save(formData: FormData) {
    setIsSaving(true);
    try {
      const reply = await saveTimezoneAction(formData.get("timezone"), version);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't save", description: "Check the connection and try again." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <TimezonePicker key={`${zone}:${version}`} name="timezone" defaultZone={zone} />
      <Button type="submit" className="self-start" loading={isSaving} loadingText="Saving…">
        Save time zone
      </Button>
    </form>
  );
}
