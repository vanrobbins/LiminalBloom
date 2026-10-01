// Signing out from the account menu. Better Auth ends the session on the
// server, so the cookie is useless afterwards even if it lingers.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

export function useSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  // State lags a render behind; the ref stops a second tap in the same one.
  const isBusy = useRef(false);

  async function signOut() {
    if (isBusy.current) {
      return;
    }
    isBusy.current = true;
    setIsSigningOut(true);

    // Offline, the request rejects instead of returning { error }.
    let error: unknown;
    try {
      ({ error } = await authClient.signOut());
    } catch (thrown) {
      error = thrown;
    }

    if (error) {
      isBusy.current = false;
      setIsSigningOut(false);
      toast({
        tone: "error",
        title: "Couldn't sign out.",
        description: "Check your connection and try again.",
      });
      return;
    }

    toast({ tone: "success", title: "Signed out." });
    // Replace, so Back cannot return to the signed-in page; refresh, so the
    // router cache holds nothing of the person who just left (Next restores
    // back/forward from it). Store devices are shared.
    router.replace("/sign-in");
    router.refresh();
  }

  return { signOut, isSigningOut };
}
