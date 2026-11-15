// Sign in. Reads `?next=` (where an invitation link sends a signed-out
// visitor back to), keeps it only if it is a path on this site, and hands it to the form.

import { safeReturnPath } from "@/lib/return-path";

import { SignInForm } from "./form";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <SignInForm next={safeReturnPath(typeof next === "string" ? next : null)} />;
}
