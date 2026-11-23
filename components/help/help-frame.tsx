// The frame of a help page (spec 0.7.1 9.3, 12). A member gets the app shell's page: its header, a reading
// column. A person with no store, a missing two-step or only paused stores has no shell, so the page sits in
// the same card /welcome uses. One route, chosen by the page from `getCurrentMember().kind`.

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/components/invite/page-shell";
import { PageHeader } from "@/components/shell/page-header";
import type { CurrentMember } from "@/lib/current-member";

type Back = { href: string; label: string };

/** Where Help's own page leads back to for someone without the shell: the page that sent them. */
const HOME: Record<string, Back> = {
  paused: { href: "/paused", label: "Back" },
  "needs-two-factor": { href: "/account", label: "Back to Account" },
  "no-store": { href: "/welcome", label: "Back" },
};

export function HelpFrame({ kind, title, back, children }: { kind: Exclude<CurrentMember["kind"], "signed-out">; title: string; back?: Back; children: React.ReactNode }) {
  if (kind === "member") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader title={title} back={back} />
        {children}
      </div>
    );
  }
  const up = back ?? HOME[kind];
  return (
    <PageShell>
      {up ? (
        <Link href={up.href} className="inline-flex min-h-11 items-center gap-2 self-start text-ink-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
          {up.label}
        </Link>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      {children}
    </PageShell>
  );
}
