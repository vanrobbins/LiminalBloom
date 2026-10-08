// Choosing a product photo (§3.9 item 7): drag and drop on tablet and desktop,
// tap to browse on phones. The photo is shrunk here and uploaded with the form.

"use client";

import { ImageUp } from "lucide-react";
import { useState } from "react";

import { ProductImage } from "./product-image";
import { resizeImage } from "./resize-image";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type ImagePickerProps = {
  productId: string | null;
  name: string;
  categoryName: string;
  imageKey: string | null;
  onChange: (image: Blob | null) => void;
};

export function ImagePicker({ productId, name, categoryName, imageKey, onChange }: ImagePickerProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  async function take(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPEG, PNG or WebP image.");
      return;
    }
    setError(null);
    setIsWorking(true);
    try {
      const small = await resizeImage(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(small));
      onChange(small);
    } catch {
      setError("That image couldn't be read. Try another.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink">Image</p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void take(event.dataTransfer.files[0]);
        }}
        className={`flex items-center gap-4 rounded-lg border border-dashed p-4 ${isDragging ? "border-ink bg-line-subtle" : "border-line"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview blob, not a served image
          <img src={preview} alt={`New image for ${name}`} className="h-48 w-40 rounded-md object-cover" />
        ) : productId ? (
          <ProductImage productId={productId} name={name} categoryName={categoryName} imageKey={imageKey} size="lg" />
        ) : null}
        <div className="flex flex-col gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-raised px-4 text-ink focus-within:outline-2 focus-within:outline-ink">
            <ImageUp aria-hidden="true" strokeWidth={1.75} className="size-5" />
            <span>{isWorking ? "Preparing…" : "Choose image"}</span>
            <input type="file" accept={ACCEPTED.join(",")} className="sr-only" aria-label="Choose image" onChange={(event) => void take(event.target.files?.[0])} />
          </label>
          <p className="hidden text-sm text-ink-muted md:block">or drop a photo here</p>
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
