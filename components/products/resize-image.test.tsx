// The canvas stood in: jsdom has no image decoding or encoding.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resizeImage } from "./resize-image";

const toBlob = vi.fn();

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2400, height: 1600, close: () => {} })));
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
    tag === "canvas" ? ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toBlob } as unknown as HTMLCanvasElement) : createElement(tag),
  );
});
afterEach(() => {
  toBlob.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const photo = new File(["big"], "photo.jpg", { type: "image/jpeg" });

describe("resizeImage", () => {
  it("asks for WebP and keeps it when the browser can make it", async () => {
    toBlob.mockImplementation((done: (blob: Blob) => void, type: string) => done(new Blob(["x"], { type })));
    const blob = await resizeImage(photo);
    expect(blob.type).toBe("image/webp");
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.85);
  });

  it("falls back to JPEG when the browser hands back PNG instead (Safari)", async () => {
    toBlob.mockImplementation((done: (blob: Blob) => void, type: string) => done(new Blob(["x"], { type: type === "image/webp" ? "image/png" : type })));
    const blob = await resizeImage(photo);
    expect(toBlob).toHaveBeenLastCalledWith(expect.any(Function), "image/jpeg", 0.85);
    expect(blob.type).toBe("image/jpeg");
  });
});
