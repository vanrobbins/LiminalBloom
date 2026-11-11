// Whether a member holds a switch. Pure and free of server-only code, so client
// components can use it to hide what a person cannot do. Hiding is a courtesy;
// the server check (requireSwitch in lib/current-member.ts) is the rule.

import type { Switch } from "./switches";

export function can(member: { switches: readonly Switch[] }, wanted: Switch): boolean {
  return member.switches.includes(wanted);
}
