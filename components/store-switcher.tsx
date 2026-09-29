// Switch between the stores this person belongs to. One tap: Better Auth
// checks membership, the session's active store changes (and is remembered
// for next sign-in), and the page re-renders on the server for the new store.
//
// Lives at the top of /products until the app shell's user menu (piece 3).

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

type Store = { id: string; name: string };

export function StoreSwitcher({
  stores,
  activeStoreId,
}: {
  stores: Store[];
  activeStoreId: string;
}) {
  const router = useRouter();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(storeId: string) {
    setError(null);
    setSwitchingTo(storeId);

    const { error } = await authClient.organization.setActive({
      organizationId: storeId,
    });

    setSwitchingTo(null);

    if (error) {
      setError("Could not switch stores. Try again.");
      return;
    }

    router.refresh();
  }

  return (
    <nav aria-label="Stores" className="flex flex-wrap items-center gap-2">
      {stores.map((store) => {
        const isActive = store.id === activeStoreId;

        return (
          <button
            key={store.id}
            type="button"
            onClick={() => switchTo(store.id)}
            disabled={isActive || switchingTo !== null}
            aria-current={isActive ? "true" : undefined}
            className={`h-11 rounded border px-3 text-sm ${
              isActive
                ? "border-brand bg-brand font-medium text-on-brand"
                : "border-line bg-raised text-ink"
            }`}
          >
            {switchingTo === store.id ? "Switching…" : store.name}
          </button>
        );
      })}

      <a
        href="/create-store"
        className="flex h-11 items-center px-3 text-sm text-brand-strong underline"
      >
        New store
      </a>

      {error ? (
        <p role="alert" className="w-full text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </nav>
  );
}
