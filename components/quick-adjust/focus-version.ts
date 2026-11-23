// After a Quick Adjust is published (0.7.0.9 spec §7), focus moves to the version line of the page the person lands on.
// The page is a new one, so the request is held here until the version line mounts and asks for it. It expires, so a
// publish whose page never shows a version line (a monthly draft is open: Draft | Published instead) can't steal focus later.

const HOLD_MS = 5000;
let askedAt = 0;

export function wantVersionFocus() {
  askedAt = Date.now();
}

/** True once per request, within a few seconds of it. */
export function takeVersionFocus(): boolean {
  const wanted = askedAt > 0 && Date.now() - askedAt < HOLD_MS;
  askedAt = 0;
  return wanted;
}
