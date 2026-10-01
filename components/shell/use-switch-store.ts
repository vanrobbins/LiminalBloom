// Switching the store a person is working in. Shared by the store list in
// the phone's sheet and the dropdown on tablet and desktop, so the fixes
// below hold in both.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

export type Store = { id: string; name: string };

export function useSwitchStore(stores: Store[], activeStoreId: string) {
  const router = useRouter();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [seenActiveStoreId, setSeenActiveStoreId] = useState(activeStoreId);

  // A switch is over when the refreshed page arrives with that store active,
  // not when setActive answers: until then the old store is still gold, and
  // a second tap would start a second switch. (Adjusting state during render
  // is React's documented pattern for following a prop.)
  // It is also over when the page arrives with any other store (membership
  // fell back elsewhere): the shell persists, so "Switching…" must not stick.
  if (seenActiveStoreId !== activeStoreId) {
    setSeenActiveStoreId(activeStoreId);
    if (switchingTo !== null) {
      setSwitchingTo(null);
    }
  }

  /** Resolves true once the switch is accepted; false if ignored or failed. */
  async function switchTo(storeId: string): Promise<boolean> {
    // Radix sends "" when the selected item is tapped again; that and any
    // tap during a switch are ignored.
    if (!storeId || storeId === activeStoreId || switchingTo !== null) {
      return false;
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
      return false;
    }

    const name = stores.find((store) => store.id === storeId)?.name;
    toast({ tone: "success", title: `Now working in ${name}.` });
    router.refresh();
    return true;
  }

  return { switchingTo, switchTo };
}
