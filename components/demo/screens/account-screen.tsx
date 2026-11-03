// Account: switch the demo's role to see what each can do, and start the
// demo store over.

"use client";

import { seedState } from "@/lib/demo/seed";
import type { Role } from "@/lib/demo/types";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FOCUS } from "../looks";
import { ScreenTitle } from "../screen-title";

const ROLES: { role: Role; name: string; can: string }[] = [
  { role: "vm-lead", name: "VM Lead", can: "Moves products on planograms, publishes, and publishes Quick Adjusts." },
  { role: "associate", name: "Sales Associate", can: "Finds products and marks status. Sees planograms read-only and sends Quick Adjusts for review." },
];

export function AccountScreen() {
  const { state, dispatch } = useDemoStore();
  const nav = useNav();

  return (
    <>
      <ScreenTitle title="Account" sub="Sam · Pioneer Place (demo store)" />
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Your role in this store</h3>
        <div role="radiogroup" aria-label="Role" className="flex flex-col gap-2">
          {ROLES.map(({ role, name, can }) => (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={state.role === role}
              onClick={() => {
                dispatch({ type: "role", role });
                nav.say(`You're now a ${name}.`);
              }}
              className={`rounded-lg border p-3 text-left ${state.role === role ? "border-brand bg-raised" : "border-line"} ${FOCUS}`}
            >
              <span className="flex items-center gap-2 font-medium">
                <span aria-hidden="true" className={`size-4 rounded-full ${state.role === role ? "border-[5px] border-brand" : "border border-line"}`} />
                {name}
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{can}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2 border-t border-line-subtle pt-4">
        <h3 className="font-semibold">Demo store</h3>
        <p className="text-sm text-ink-muted">Everything here is made up and kept only in this browser tab. Reloading the page starts over too.</p>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "reset", state: seedState() });
            nav.say("The demo store is back to how it started.");
          }}
          className={`min-h-11 self-start rounded border border-line bg-raised px-4 ${FOCUS}`}
        >
          Start the demo store over
        </button>
      </section>
    </>
  );
}
