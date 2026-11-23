// A follow-up step after two-factor has already changed: it must never fail the change (the person would be
// told it failed and, without the new cookie, signed out as well), and one failing must not skip the others.
// So each step runs on its own and a failure is only logged.

import "server-only";

export async function bestEffort(what: string, step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (error) {
    console.error(`two-factor follow-up step failed: ${what}`, error);
  }
}
