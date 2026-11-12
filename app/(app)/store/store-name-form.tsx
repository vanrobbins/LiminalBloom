// The store's name on Store settings: a field and Save. The page reloads after a
// save so the header and the store switcher show the new name.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_STORE_NAME, MIN_STORE_NAME } from "@/lib/store-name-limits";
import { toast } from "@/lib/toast";

import { renameStoreAction } from "./actions";

export function StoreNameForm({ name }: { name: string }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function save(formData: FormData) {
    setIsSaving(true);
    try {
      const reply = await renameStoreAction(formData.get("name"), name);
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
      {/* Keyed on the saved name, so the field shows what is stored after a reload. */}
      <Input key={name} label="Store name" name="name" defaultValue={name} required minLength={MIN_STORE_NAME} maxLength={MAX_STORE_NAME} autoComplete="off" />
      <Button type="submit" className="self-start" loading={isSaving} loadingText="Saving…">
        Save store name
      </Button>
    </form>
  );
}
