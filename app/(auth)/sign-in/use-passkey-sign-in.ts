// Signing in with a passkey (spec 0.7.1 8.4, A3c), two ways: the "Sign in with a passkey" button (the browser's own
// prompt, any passkey for this site), and browser autofill, which offers the person's passkeys in the email field's
// own list (`autocomplete="username webauthn"`) while the page is open. Either one ends in the same place as a
// password sign-in. The session it makes has `two_factor_at`, so a passkey is also the second step
// (lib/auth-factors.ts); nothing here asks for a code.

"use client";

import { useEffect, useRef, useState } from "react";

import { signIn } from "@/lib/auth-client";
import { CONNECTION_ERROR } from "@/lib/connection-error";

// The browser's own ways a prompt ends without a sign-in (closed, cancelled, timed out): not worth a message.
const QUIET = new Set(["AUTH_CANCELLED", "ERROR_CEREMONY_ABORTED"]);
const FAILED = "That passkey didn't work. Try again, or sign in with your password.";

/** `onSignedIn` runs once a passkey sign-in has made a session. */
export function usePasskeySignIn(onSignedIn: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // The latest callback without re-running the autofill effect (that would start a second browser request).
  const done = useRef(onSignedIn);
  useEffect(() => {
    done.current = onSignedIn;
  });

  useEffect(() => {
    let alive = true;
    async function offerAutofill() {
      try {
        if (typeof PublicKeyCredential === "undefined" || !(await PublicKeyCredential.isConditionalMediationAvailable?.())) return;
        const reply = await signIn.passkey({ autoFill: true });
        if (alive && reply?.data) done.current();
      } catch {
        // Autofill is a convenience; the form and the button still work.
      }
    }
    void offerAutofill();
    return () => {
      alive = false;
    };
  }, []);

  async function signInWithPasskey() {
    setError(null);
    setPending(true);
    try {
      const reply = await signIn.passkey();
      if (reply?.data) {
        done.current();
        return;
      }
      if (reply?.error && !QUIET.has(String((reply.error as { code?: string }).code))) setError(FAILED);
    } catch {
      setError(CONNECTION_ERROR);
    }
    setPending(false);
  }

  return { passkeyError: error, passkeyPending: pending, signInWithPasskey };
}
