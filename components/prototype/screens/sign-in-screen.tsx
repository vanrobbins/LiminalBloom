// Sign-in, with the store sheet a signed-in person opens to switch stores.

import { Check, Plus } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <span className="flex h-10 items-center rounded border border-line bg-raised px-3 text-sm text-ink">{value}</span>
    </span>
  );
}

export function SignInScreen() {
  return (
    <MockScreen tab="none">
      <div className="mt-4 flex items-center gap-2">
        <span aria-hidden="true" className="size-5 rounded-full bg-brand" />
        <span className="text-lg font-semibold tracking-tight text-ink">Sign in</span>
      </div>
      <Field label="Email" value="sam@example.com" />
      <Field label="Password" value="••••••••••••" />
      <span className="flex items-center gap-2 text-sm text-ink">
        <span aria-hidden="true" className="size-4 rounded-sm border border-line bg-raised" />
        Keep me signed in
        <Marker n={2} />
      </span>
      <span className="flex items-center gap-2">
        <span className="flex h-11 flex-1 items-center justify-center rounded bg-brand text-sm font-medium text-on-brand">
          Sign in
        </span>
        <Marker n={1} />
      </span>

      <div className="mt-auto -mx-4 -mb-3 rounded-t-2xl border-t border-line bg-raised px-4 pt-2 pb-5">
        <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" />
        <p className="mb-1 text-xs text-ink-muted">Your stores</p>
        <span className="flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-strong">
          <Check aria-hidden="true" strokeWidth={2} className="size-4" />
          Pioneer Place
          <Marker n={3} />
        </span>
        <span className="flex min-h-11 items-center pl-6 text-sm text-ink">Washington Square</span>
        <span className="flex min-h-11 items-center gap-2 text-sm text-brand-strong underline underline-offset-4">
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          New store
          <Marker n={4} />
        </span>
      </div>
    </MockScreen>
  );
}
