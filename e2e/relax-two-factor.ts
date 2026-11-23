// The shared e2e accounts are Store Managers (and other roles that hold people.manage or roles.manage),
// and those roles require two-factor by default (0.7.1a, A3b): without it the app sends them to Account and
// nothing else opens. The specs that are not about two-factor work in stores where the setting is off. This
// turns it off for every store the given accounts belong to, as the owner, straight in the development
// database, as the rest of the e2e setup does (map-store.ts). It is test setup, not a switch in the app:
// the app has no way around the requirement.

import { sql } from "./map-store";

export async function relaxTwoFactor(emails: string[]): Promise<void> {
  await sql()`
    update role_definitions set requires_two_factor = false
    where requires_two_factor
      and store_id in (select m.organization_id from member m join "user" u on u.id = m.user_id where u.email = any(${emails}))`;
}
