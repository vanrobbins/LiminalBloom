// Home (0.7.0.6 spec section 2): what needs this member in this store, as cards chosen by their
// switches, with product search on top. Any member may open it, so the guard is `requireMember`;
// what each card shows is decided in lib/home. The search is in the first chunk; the cards stream
// in behind one loader, inside a boundary so a failed read replaces only them.

import { Suspense } from "react";

import { CardsBoundary } from "@/components/home/cards-boundary";
import { HomeCards } from "@/components/home/home-cards";
import { HomeSearch } from "@/components/home/home-search";
import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";
import { requireMember } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireMember();
  return (
    <div className="mx-auto w-full max-w-2xl md:max-w-5xl">
      <PageHeader title="Hub" />
      <HomeSearch />
      <CardsBoundary>
        <Suspense
          fallback={
            <div className="min-h-64">
              <Loader label="Loading your store…" />
            </div>
          }
        >
          <HomeCards />
        </Suspense>
      </CardsBoundary>
    </div>
  );
}
