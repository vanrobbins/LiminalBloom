import { describe, expect, it } from "vitest";

import { qrSvgOf } from "./qr";

describe("qrSvgOf", () => {
  it("draws an otpauth link as an SVG", async () => {
    const svg = await qrSvgOf("otpauth://totp/Liminal%20Bloom:van%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Liminal%20Bloom");
    expect(svg).toMatch(/^<svg[\s>]|^<\?xml/);
    expect(svg).toContain("</svg>");
  });

  it("answers null, never throws, for text it cannot draw", async () => {
    expect(await qrSvgOf("x".repeat(8000))).toBeNull();
  });
});
