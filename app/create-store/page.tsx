// Onboarding: a signed-in person with no store makes one here.
//
// In the finished product an Admin creates the store and invites everyone
// else (section 3.1), so this is not the path most team members take -- they
// arrive by invitation. This is the first-run case.

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

  // Already in a store? Then this page has nothing to offer.
  const organizations = await auth.api.listOrganizations({
    headers: requestHeaders,
  });
  if (organizations.length > 0) {
    redirect("/products");
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
