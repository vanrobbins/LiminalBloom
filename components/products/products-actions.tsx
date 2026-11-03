// The Products title row's actions (Week 6.5 spec §2.2). From 768 px: a
// Categories button and the gold Add product. On a phone: a 44 px + (Add
// product) and a ⋯ menu holding Categories, beside the avatar. Nothing floats.

"use client";

import { Ellipsis, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ProductsActions() {
  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <Button variant="secondary" asChild>
          <Link href="/products/categories">Categories</Link>
        </Button>
        <Button asChild>
          <Link href="/products/new">Add product</Link>
        </Button>
      </div>
      <div className="flex items-center md:hidden">
        <Button variant="secondary" icon asChild>
          <Link href="/products/new" aria-label="Add product">
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" icon aria-label="More product actions" className="ml-1">
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
    </>
  );
}
