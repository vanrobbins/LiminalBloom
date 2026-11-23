// Where to go after signing in or up: a path on this site, carried in `?next=`
// (an invitation link sends a signed-out visitor through sign-in and back). The
// value comes from the address bar, so it is untrusted: only a plain same-site
// path is accepted, never a full address or a protocol-relative one.

const MAX_LENGTH = 500;

/** The path if it stays on this site, else null. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return null;
  // One leading slash; "//host" and "/\host" are read by browsers as another site.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // Control characters and spaces can hide a different address from a browser's parser.
  if (/[\u0000- \u007f]/.test(value)) return null;
  // The sign-in and sign-up pages would only bring the person back here.
  if (/^\/sign-(in|up)(?:[/?#]|$)/.test(value)) return null;
  // Belt and braces: it must still resolve to this site once parsed.
  const base = "http://same-site.invalid";
  try {
    return new URL(value, base).origin === base ? value : null;
  } catch {
    return null;
  }
}

/** A link to sign in or sign up that returns to `next` afterwards (or a bare link when `next` is not safe). */
export function authHref(page: "/sign-in" | "/sign-in/two-factor" | "/sign-up", next: string | null | undefined): string {
  const safe = safeReturnPath(next);
  return safe ? `${page}?next=${encodeURIComponent(safe)}` : page;
}
