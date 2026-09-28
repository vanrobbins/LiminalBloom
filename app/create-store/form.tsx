// The form itself. Split from page.tsx because it needs client-side state
// for the pending and error states; the page around it stays a Server
// Component. This is the "push 'use client' down" rule from CODESTYLE.md.

"use client";

import { useActionState } from "react";

import { createStore } from "./actions";

export function CreateStoreForm() {
  const [state, formAction, pending] = useActionState(createStore, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-[#231D18] dark:text-[#F7F2EA]">
        Store name
        <input
          name="name"
          type="text"
          required
          minLength={2}
          placeholder="Pioneer Place"
          className="min-h-11 rounded border border-[#231D18]/20 bg-white px-3 text-base text-[#231D18] dark:border-[#F7F2EA]/20 dark:bg-[#231D18] dark:text-[#F7F2EA]"
        />
      </label>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded bg-[#E8B93A] px-4 font-medium text-[#231D18] disabled:opacity-60"
      >
        {pending ? "Creating store…" : "Create store"}
      </button>
    </form>
  );
}
