// The setup QR code: Better Auth's otpauth link drawn as an SVG on the server, so no QR code
// library reaches the browser (`qrcode`, DECISIONS 11-22). The link holds the secret, so the SVG is
// made inside the setup action and goes back only in its reply to the account's owner, never logged.

import "server-only";

import QRCode from "qrcode";

/** The SVG text for an otpauth link, or null if it can't be drawn (the typed key beside it still works). */
export async function qrSvgOf(otpauthUri: string): Promise<string | null> {
  try {
    return await QRCode.toString(otpauthUri, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  } catch {
    return null;
  }
}
