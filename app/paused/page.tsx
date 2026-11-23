// Where someone lands when every store they belong to is paused by Liminal Bloom (spec 0.7.1 7.4). Sign-in
// still works, because a person may have other stores; this is only for someone who has none that open.
// Nothing here reads a store: the names come from getCurrentMember().

import { ReplyBanner } from "@/components/help/reply-banner";
import { PageShell } from "@/components/invite/page-shell";
import { SignOutButton } from "@/components/paused/sign-out-button";
import { getCurrentMember } from "@/lib/current-member";
import { helpRepliesFor } from "@/lib/help/badge";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PausedPage() {
  const current = await getCurrentMember();
  if (current.kind === "signed-out") redirect("/sign-in");
  if (current.kind === "no-store") redirect("/welcome");
  if (current.kind === "needs-two-factor") redirect("/account");
  if (current.kind === "member") redirect("/home");

  const { stores } = current;
  const helpReplies = await helpRepliesFor(current.user.id);
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{stores.length === 1 ? "Your store is paused" : "Your stores are paused"}</h1>
      {stores.length === 1 ? (
        <p className="text-ink">
          <strong className="font-semibold wrap-break-word">{stores[0].name}</strong> is paused by Liminal Bloom. Nothing has been deleted.
        </p>
      ) : (
        <>
          <p className="text-ink">These stores are paused by Liminal Bloom. Nothing has been deleted.</p>
          <ul className="flex flex-col gap-1 text-ink">
            {stores.map((s) => (
              <li key={s.id} className="font-semibold wrap-break-word">
                {s.name}
              </li>
            ))}
          </ul>
        </>
      )}
      <ReplyBanner replies={helpReplies} />
      {/* Ask Liminal Bloom (the help button, plan A9) goes here once /help exists. */}
      <SignOutButton />
    </PageShell>
  );
}
