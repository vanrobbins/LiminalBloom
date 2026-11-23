// A Chromium virtual authenticator (CDP WebAuthn.addVirtualAuthenticator), so a spec needs no real key or prompt.
// Desktop Chromium only: WebAuthn over CDP is a Chromium feature, and the authenticator is the same at every size.

import type { BrowserContext, Page } from "@playwright/test";

/**
 * A software authenticator that holds resident keys and says yes to every touch and user verification. The sign-in page also
 * offers its keys in the browser's autofill list, and with automatic yes a page that has one would sign in on its own as soon as
 * the email field is used; `presence(false)` stops the yes for a spec that signs in with the password first.
 */
export async function addVirtualAuthenticator(context: BrowserContext, page: Page) {
  const client = await context.newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { presence: (enabled: boolean) => client.send("WebAuthn.setAutomaticPresenceSimulation", { authenticatorId, enabled }) };
}
