// The frame of /company (spec 0.7.1 6.1, 9.3, 12). A person with a store gets the app shell's page: its header and a
// reading column. A company person with no store yet (a new owner, or a regional manager of an empty region) has no
// shell, so the page stands alone in the same reading column with Help, Account and Sign out, the way /help does for
// someone without a shell. The page chooses by `kind`; both draw the same sections.

import { LifeBuoy, UserRound } from "lucide-react";
import Link from "next/link";

import { CornerThemeToggle } from "@/components/corner-theme-toggle";
import { SignOutButton } from "@/components/paused/sign-out-button";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";

export function CompanyFrame({ kind, title, children }: { kind: "member" | "company-only"; title: string; children: React.ReactNode }) {
  if (kind === "member") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader title={title} />
        {children}
      </div>
    );
  }
  return (
    <main className="min-h-screen bg-surface px-4 py-10 md:px-8">
      <CornerThemeToggle />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink wrap-break-word">{title}</h1>
        {children}
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/help">
              <LifeBuoy aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
              Help
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/account">
              <UserRound aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
              Account
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
