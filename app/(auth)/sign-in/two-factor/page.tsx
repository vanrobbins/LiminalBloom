// The code step of sign-in. Reads `?next=` as the sign-in page does and keeps it only if it is a
// path on this site. No guard: Better Auth's own challenge cookie decides whether a code can be
// checked, and the form says "This sign-in timed out" when there is none.

import { safeReturnPath } from "@/lib/return-path";

import { TwoFactorForm } from "./form";

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <TwoFactorForm next={safeReturnPath(typeof next === "string" ? next : null)} />;
}
