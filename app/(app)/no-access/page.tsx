// Where a member lands after asking for a page their role does not allow
// (requireSwitch in lib/current-member.ts). It needs only requireMember(), never
// a switch, so it cannot send anyone round in a loop. Every role holds `view`,
// so Products is always somewhere they can go.

import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  await requireMember();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title="You don't have access to this" />
      <Card className="flex flex-col items-start gap-3">
        <p className="text-ink">Your role in this store doesn&apos;t include this page. A manager can change what a role allows.</p>
        <Button asChild variant="secondary">
          <Link href="/home">Back to Home</Link>
        </Button>
      </Card>
    </div>
  );
}
