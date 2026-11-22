// Card 4, "Not placed yet" (0.7.0.6 spec section 4): up to two rows, each a count that links to
// where it is fixed. A row with a zero count is left out.

import { PackageSearch } from "lucide-react";
import Link from "next/link";

import type { NotPlaced } from "@/lib/home/types";

import { HomeCard } from "./home-card";

const LINK = "flex min-h-11 items-center py-2 text-ink wrap-break-word";

export function NotPlacedCard({ notPlaced }: { notPlaced: NotPlaced }) {
  const { products, fixtures } = notPlaced;
  return (
    <HomeCard title="Not placed yet" icon={PackageSearch}>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {products > 0 ? (
          <li>
            <Link href="/products?place=unplaced" className={LINK}>
              {products} {products === 1 ? "product" : "products"} not placed
            </Link>
          </li>
        ) : null}
        {fixtures > 0 ? (
          <li>
            <Link href="/planograms" className={LINK}>
              {fixtures} {fixtures === 1 ? "fixture" : "fixtures"} without a planogram
            </Link>
          </li>
        ) : null}
      </ul>
    </HomeCard>
  );
}
