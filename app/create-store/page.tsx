// Create a store. The first-run case for someone with no store, and also how
// an existing member adds another: a person can belong to several stores
// (docs/DECISIONS.md, 2026-09-29), and whoever creates one becomes its owner.
//
// Most team members still arrive by invitation (section 3.1).

import { redirect } from "next/navigation";

import { CornerThemeToggle } from "@/components/corner-theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/current-member";

import { CreateStoreForm } from "./form";

export const dynamic = "force-dynamic";

export default async function CreateStorePage() {
  const member = await getCurrentMember();
  if (member.kind === "signed-out") {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-16">
      <CornerThemeToggle />
      <Card className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Create your store
        </h1>
        <p className="text-sm text-ink-muted">
          Everything in Liminal Bloom belongs to a store: products, planograms,
          and the people who work there.
        </p>
        <CreateStoreForm />
        {/* Someone adding a second store can change their mind. Someone with
            no store has nowhere to go back to. */}
        {member.kind === "member" ? (
          <Button asChild variant="ghost">
            <a href="/products">Back to products</a>
          </Button>
        ) : null}
      </Card>
    </main>
  );
}
