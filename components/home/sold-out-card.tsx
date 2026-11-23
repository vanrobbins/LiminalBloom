// "Sold out on display" (0.7.0.9 Quick Adjust, spec Q6): sold-out products that still have a floor location,
// the gap Quick Adjust closes. One row with the count, linking to those products; the location sheet there
// carries the Quick Adjust icon for each place. Hides at zero (shownCards), so the count here is above zero.

import { PackageX } from "lucide-react";
import Link from "next/link";

import type { SoldOut } from "@/lib/home/types";

import { HomeCard } from "./home-card";

export function SoldOutCard({ soldOut }: { soldOut: SoldOut }) {
  const { products } = soldOut;
  return (
    <HomeCard title="Sold out on display" icon={PackageX}>
      <Link href="/products?status=sold_out&place=floor" className="flex min-h-11 items-center py-2 text-ink wrap-break-word">
        {products} sold-out {products === 1 ? "product" : "products"} still on display
      </Link>
    </HomeCard>
  );
}
