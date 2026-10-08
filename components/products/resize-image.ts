// Shrinks a photo in the browser before upload, with a canvas: no library,
// and the server still checks the result (spec §5.4).

import { fitWithin } from "@/lib/products/image-size";

export async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  let blob = await encode("image/webp");
  // Safari (every iPhone browser) can't encode WebP and hands back PNG, often
  // over the server's 2 MB limit at this size. JPEG is small and accepted.
  if (blob && blob.type !== "image/webp") blob = await encode("image/jpeg");
  if (!blob) throw new Error("Could not encode the image");
  return blob;
}
