// The ⋯ menu in a Products card's corner, from 1024 px (Week 6.5 spec §2.2):
// Edit, and Delete behind the usual confirm. Below 1024 px a card has one tap
// target only, so this isn't rendered there.

"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DeleteProductDialog } from "@/components/products/delete-product-button";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type SearchCardMenuProps = { productId: string; version: number; name: string; onDeleted: (productId: string) => void };

export function SearchCardMenu({ productId, version, name, onDeleted }: SearchCardMenuProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <>
      {/* Not modal: a modal menu closing as the dialog opens can leave the page unclickable. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" icon aria-label={`More for ${name}`}>
            <Ellipsis aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/products/${productId}`}>Edit</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setIsDeleting(true)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteProductDialog
        productId={productId}
        version={version}
        name={name}
        open={isDeleting}
        onOpenChange={setIsDeleting}
        onDeleted={() => onDeleted(productId)}
      />
    </>
  );
}
