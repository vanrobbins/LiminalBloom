// Where someone lands when every store they belong to is paused by Liminal Bloom (spec 0.7.1 7.4). Sign-in
// still works, because a person may have other stores; this is only for someone who has none that open.
// Nothing here reads a store: the names come from getCurrentMember().

import { AskButton } from "@/components/help/ask-button";
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
  if (current.kind === "company-only") redirect("/company");
  if (current.kind === "member") redirect("/home");

  const { stores } = current;
  const helpReplies = await helpRepliesFor(current.user.id);
  const single = stores.length === 1 ? stores[0] : null;
  const allStores = stores.every((s) => s.kind === "store");
  const allCompanies = stores.every((s) => s.kind === "company");
  const heading = single
    ? single.kind === "company"
      ? `${single.name} is paused`
      : "Your store is paused"
    : allStores
      ? "Your stores are paused"
      : allCompanies
        ? "Your companies are paused"
        : "Some of your access is paused";
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{heading}</h1>
      {single ? (
        single.kind === "company" ? (
          <p className="text-ink">
            Liminal Bloom paused <strong className="font-semibold wrap-break-word">{single.name}</strong>. Nothing has been deleted.
          </p>
        ) : (
          <p className="text-ink">
            <strong className="font-semibold wrap-break-word">{single.name}</strong> is paused by Liminal Bloom. Nothing has been deleted.
          </p>
        )
      ) : (
        <>
          <p className="text-ink">
            {allStores
              ? "These stores are paused by Liminal Bloom. Nothing has been deleted."
              : allCompanies
                ? "Liminal Bloom paused these companies. Nothing has been deleted."
                : "Liminal Bloom paused these. Nothing has been deleted."}
          </p>
          <ul className="flex flex-col gap-1 text-ink">
            {stores.map((s) => (
              <li key={s.id} className="font-semibold wrap-break-word">
                {s.name}
                {s.kind === "company" && !allCompanies ? <span className="font-normal"> (company)</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}
      <ReplyBanner replies={helpReplies} />
      <AskButton kind="account" from="/paused" />
      <SignOutButton />
    </PageShell>
  );
}
