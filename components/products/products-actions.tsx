// The Products title row's actions (Week 6.5 spec §2.2; icons only, 0.7.0.5). A
// Categories icon from 768 px and the gold + (Add product) at every size. On a
// phone Categories is in a ⋯ menu, beside the avatar. Nothing floats.

"use client";

import { Ellipsis, Plus, Tags } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { can, type Holder } from "@/lib/access/can";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ProductsActions({ member }: { member: Holder }) {
  // Add product and Categories are for editors; everyone else has no actions here.
  if (!can(member, "products.edit")) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:block">
        <Button variant="secondary" icon asChild>
          <Link href="/products/categories" aria-label="Categories">
            <Tags aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Link>
        </Button>
      </div>
      <Button icon asChild>
        <Link href="/products/new" aria-label="Add product">
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Link>
      </Button>
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" icon aria-label="More product actions">
              <Ellipsis aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/products/categories">Categories</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
