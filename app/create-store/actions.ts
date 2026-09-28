// Server Actions for store creation.
//
// "use server" marks every export here as something the browser may ask the
// server to run. That makes each one a public entry point, so each must check
// the session itself -- never assume the caller was allowed to get here.
// See proposal section 8.3.

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/** "Pioneer Place" -> "pioneer-place". Organizations are addressed by slug. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createStore(
  _previous: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    redirect("/sign-in");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return { error: "Give the store a name of at least two characters." };
  }

  const base = slugify(name);
  if (!base) {
    return { error: "That name has no letters or numbers in it." };
  }

  // Slugs are unique across every store, so a second "Pioneer Place" needs a
  // different one. Try the clean slug, then fall back to a suffixed version
  // rather than making the person rename their store.
  const candidates = [base, `${base}-${Math.random().toString(36).slice(2, 7)}`];

  let lastError = "Could not create the store.";

  for (const slug of candidates) {
    try {
      await auth.api.createOrganization({
        body: { name, slug },
        headers: requestHeaders,
      });

      // Make it the store this session is working in. Every scoped query
      // reads activeOrganizationId from the session.
      await auth.api.setActiveOrganization({
        body: { organizationSlug: slug },
        headers: requestHeaders,
      });

      redirect("/products");
    } catch (error) {
      // `redirect()` works by throwing, so it must be re-thrown rather than
      // swallowed as a failure. This is a real and easy mistake to make.
      if (
        error instanceof Error &&
        error.message === "NEXT_REDIRECT"
      ) {
        throw error;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "digest" in error &&
        typeof error.digest === "string" &&
        error.digest.startsWith("NEXT_REDIRECT")
      ) {
        throw error;
      }
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  return { error: lastError };
}
