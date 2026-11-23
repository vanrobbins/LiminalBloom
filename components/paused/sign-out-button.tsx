// Sign out on /paused, which has no app shell to hold the account menu.

"use client";

import { useSignOut } from "@/components/shell/use-sign-out";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const { signOut, isSigningOut } = useSignOut();
  return (
    <Button type="button" variant="secondary" loading={isSigningOut} loadingText="Signing out…" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
