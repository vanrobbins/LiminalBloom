// Adding or editing a product (spec §5.1–5.2). Saves through a server action
// that re-validates everything; a refused save says why beside the field, and
// a save beaten by another device reloads the current values.

"use client";

import { Label } from "radix-ui";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { saveProduct } from "@/app/(app)/products/actions";
import { uploadProductImage } from "@/app/(app)/products/image-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { PRODUCT_STATUS, type ProductStatus } from "@/lib/product-status";
import type { Overrides } from "@/lib/products/footprint";
import { IMAGE_EXTENSION, type ImageType } from "@/lib/products/image-check";
import type { CategoryRow, ProductRow } from "@/lib/products/queries";
import { PRODUCT_STATUSES } from "@/lib/products/schemas";
import { toast } from "@/lib/toast";

import { CategorySelect } from "./category-select";
import { FootprintFields } from "./footprint-fields";
import { ImagePicker } from "./image-picker";

type ProductFormProps = {
  categories: CategoryRow[];
  product?: ProductRow;
  overrides?: Overrides;
};

export function ProductForm({ categories: initialCategories, product, overrides: initialOverrides = {} }: ProductFormProps) {
  const router = useRouter();
  const statusId = useId();
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? initialCategories[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [image, setImage] = useState<Blob | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const category = categories.find((c) => c.id === categoryId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      name: String(data.get("name") ?? ""),
      styleNumber: String(data.get("styleNumber") ?? ""),
      categoryId,
      color: String(data.get("color") ?? ""),
      sizeRange: String(data.get("sizeRange") ?? ""),
      status: String(data.get("status") ?? "in_stock"),
      overrides: { hung: overrides.hung ?? null, folded: overrides.folded ?? null },
    };
    setIsSaving(true);
    try {
      const result = await saveProduct(product?.id ?? null, product?.version ?? null, input);
      if (result.status === "invalid") {
        setErrors(result.errors);
        return;
      }
      if (result.status === "conflict") {
        toast({ tone: "error", title: "Changed on another device", description: "The current details are loaded. Make your change again." });
        router.refresh();
        return;
      }
      if (image) {
        // The product is saved now: an image failure must not read as a failed save,
        // or a retry on /products/new would trip over its own style number.
        try {
          const form = new FormData();
          form.set("image", image, `image.${IMAGE_EXTENSION[image.type as ImageType] ?? "webp"}`);
          const upload = await uploadProductImage(result.id, form);
          if (upload.status === "error") toast({ tone: "error", title: "Saved, but the image wasn't", description: upload.message });
        } catch {
          toast({ tone: "error", title: "Saved, but the image wasn't", description: "Check your connection, then add the image again." });
        }
      }
      toast({ tone: "success", title: product ? "Changes saved" : "Product added" });
      router.push("/products");
    } catch {
      toast({ tone: "error", title: "Couldn't save", description: "Check your connection and try again." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input label="Name" name="name" defaultValue={product?.name} error={errors.name} required />
      <Input label="Style number" name="styleNumber" defaultValue={product?.styleNumber} error={errors.styleNumber} required autoCapitalize="characters" />
      <CategorySelect
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        onAdded={(c) => setCategories((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)))}
        error={errors.categoryId}
      />
      <Input label="Color" name="color" defaultValue={product?.color} error={errors.color} required />
      <Input label="Size range" name="sizeRange" defaultValue={product?.sizeRange} hint="For example XS–XL or 24–34." error={errors.sizeRange} />
      <div className="flex flex-col gap-1">
        <Label.Root htmlFor={statusId} className="text-sm text-ink">
          Status
        </Label.Root>
        <select id={statusId} name="status" defaultValue={product?.status ?? "in_stock"} className={FIELD_CLASSES}>
          {PRODUCT_STATUSES.map((s: ProductStatus) => (
            <option key={s} value={s}>
              {PRODUCT_STATUS[s].label}
            </option>
          ))}
        </select>
      </div>
      <ImagePicker
        productId={product?.id ?? null}
        name={product?.name ?? "New product"}
        categoryName={category?.name ?? ""}
        imageKey={product?.imageKey ?? null}
        onChange={setImage}
      />
      {category ? <FootprintFields category={category} overrides={overrides} onChange={setOverrides} /> : null}
      {errors.overrides ? <p className="text-sm text-danger">{errors.overrides}</p> : null}
      <Button type="submit" loading={isSaving} loadingText="Saving…">
        {product ? "Save changes" : "Add product"}
      </Button>
    </form>
  );
}
