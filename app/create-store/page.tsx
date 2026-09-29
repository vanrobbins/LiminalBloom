// Create a store. The first-run case for someone with no store, and also how
// an existing member adds another: a person can belong to several stores
// (docs/DECISIONS.md, 2026-09-29), and whoever creates one becomes its owner.
//
// Most team members still arrive by invitation (section 3.1).

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { CreateStoreForm } from "./form";

export const dynamic = "force-dynamic";

export default async function CreateStorePage() {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Create your store
        </h1>
        <p className="text-sm text-ink-muted">
          Everything in Liminal Bloom belongs to a store: products, planograms,
          and the people who work there.
        </p>
        <CreateStoreForm />
      </div>
    </main>
  );
}
