// /admin/people?email= (spec 0.7.1 7.3): look an account up by its exact email. Account facts only.

import { LookupForm } from "@/components/admin/lookup-form";
import { PersonCard } from "@/components/admin/person-card";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { lookupPerson } from "@/lib/admin/reads-people";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin();
  const raw = (await searchParams).email;
  const email = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const person = email ? await lookupPerson(email) : null;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">People</h1>
      <LookupForm email={email} />
      <div aria-live="polite">
        {person ? <PersonCard person={person} /> : email ? <p className="text-ink-muted">No account has that email.</p> : <p className="text-ink-muted">Type an email to find a person.</p>}
      </div>
    </>
  );
}
