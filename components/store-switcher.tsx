// Switch between the stores this person belongs to. One tap: Better Auth
// checks membership, the session's active store changes (and is remembered
// for next sign-in), and the page re-renders on the server for the new store.
//
// A Radix ToggleGroup: one store is selected, arrow keys move between them,
// and the selected one is gold (§5.5, current selection).
//
// Lives at the top of /products until the app shell's user menu (piece 3).

"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ToggleGroup } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

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

  // A switch is over when the refreshed page arrives with that store active,
  // not when setActive answers: until then the old store is still gold, and
  // a second tap would start a second switch. (Adjusting state during render
  // is React's documented pattern for following a prop.)
  if (switchingTo !== null && switchingTo === activeStoreId) {
    setSwitchingTo(null);
  }

  async function switchTo(storeId: string) {
    // Radix sends "" when the selected item is tapped again; that and any
    // tap during a switch are ignored.
    if (!storeId || storeId === activeStoreId || switchingTo !== null) {
      return;
    }

    setSwitchingTo(storeId);

    // Offline, the request rejects instead of returning { error }.
    let error: unknown;
    try {
      ({ error } = await authClient.organization.setActive({
        organizationId: storeId,
      }));
    } catch (thrown) {
      error = thrown;
    }

    if (error) {
      setSwitchingTo(null);
      toast({
        tone: "error",
        title: "Couldn't switch stores.",
        description: "Check your connection and try again.",
      });
      return;
    }

    const name = stores.find((store) => store.id === storeId)?.name;
    toast({ tone: "success", title: `Now working in ${name}.` });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup.Root
        type="single"
        value={activeStoreId}
        onValueChange={switchTo}
        aria-label="Stores"
        className="flex flex-wrap gap-2"
      >
        {stores.map((store) => (
          <ToggleGroup.Item
            key={store.id}
            value={store.id}
            data-store-name={store.name}
            className="inline-flex min-h-11 max-w-full items-center rounded border border-line bg-raised px-3 py-2 text-left text-sm text-ink wrap-anywhere focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:font-medium data-[state=on]:text-on-brand"
          >
            {switchingTo === store.id ? "Switching…" : store.name}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <Button asChild variant="ghost">
        <a href="/create-store">
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          New store
        </a>
      </Button>
    </div>
  );
}
