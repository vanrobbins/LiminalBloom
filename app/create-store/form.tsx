// The form itself. Split from page.tsx because it needs client-side state
// for the pending and error states; the page around it stays a Server
// Component. This is the "push 'use client' down" rule from CODESTYLE.md.

"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONNECTION_ERROR } from "@/lib/connection-error";

import { createStore } from "./actions";

/** Offline, the action rejects; a redirect() must still go through (unstable_rethrow). */
async function createStoreOrExplain(previous: { error: string } | null, formData: FormData) {
  try {
    return await createStore(previous, formData);
  } catch (error) {
    unstable_rethrow(error);
    return { error: CONNECTION_ERROR };
  }
}

export function CreateStoreForm() {
  const [state, formAction, pending] = useActionState(createStoreOrExplain, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input label="Store name" name="name" required minLength={2} placeholder="Pioneer Place" />

      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" loading={pending} loadingText="Creating store…">
        Create store
      </Button>
    </form>
  );
}
