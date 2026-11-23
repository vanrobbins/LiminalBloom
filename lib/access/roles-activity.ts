// One line of the Recent changes card (spec 0.7, 4.8 part 6) from an access_events
// row. Written on the server so an email in an invitation event reaches only someone
// who may manage people; everyone else is told "an invitation". An event this version
// doesn't know (a later release's) reads "made a change", never an error.

import { isSwitch, SWITCH_TEXT } from "./switches";

type Detail = Record<string, unknown>;

const text = (detail: Detail, key: string, fallback: string) => (typeof detail[key] === "string" && detail[key] ? (detail[key] as string) : fallback);

function switchNames(detail: Detail, key: string): string {
  const list = Array.isArray(detail[key]) ? detail[key].filter(isSwitch) : [];
  return list.map((s) => SWITCH_TEXT[s].label).join(", ");
}

export function activityText(event: string, actor: string, detail: Detail, canSeeEmails: boolean): string {
  const role = text(detail, "role", "a role");
  const email = text(detail, "email", "someone");
  switch (event) {
    case "role_created":
      return `${actor} added the role ${role}`;
    case "role_renamed":
      return `${actor} renamed ${text(detail, "from", "a role")} to ${text(detail, "to", "a new name")}`;
    case "role_switches_changed": {
      const on = switchNames(detail, "added");
      const off = switchNames(detail, "removed");
      const parts = [on ? `turned on ${on}` : "", off ? `turned off ${off}` : ""].filter(Boolean);
      return `${actor} changed ${role}${parts.length ? `: ${parts.join("; ")}` : ""}`;
    }
    case "role_two_factor_changed":
      return detail.on === true ? `${actor} made ${role} require two-factor sign-in` : `${actor} stopped ${role} requiring two-factor sign-in`;
    case "role_reordered":
      return `${actor} moved ${role} ${detail.direction === "up" ? "above" : "below"} ${text(detail, "past", "another role")}`;
    case "role_reset":
      return `${actor} reset ${role} to its default`;
    case "role_deleted": {
      const people = typeof detail.people === "number" ? detail.people : 0;
      return people > 0 ? `${actor} deleted ${role} and moved ${people === 1 ? "1 person" : `${people} people`} to ${text(detail, "movedTo", "another role")}` : `${actor} deleted ${role}`;
    }
    case "member_role_changed":
      return `${actor} changed ${text(detail, "person", "someone")} from ${text(detail, "from", "a role")} to ${text(detail, "to", "a role")}`;
    case "member_removed":
      return `${actor} removed ${text(detail, "person", "someone")}`;
    case "invitation_created":
      return canSeeEmails ? `${actor} invited ${email} as ${role}` : `${actor} created an invitation as ${role}`;
    case "invitation_cancelled":
      return canSeeEmails ? `${actor} cancelled the invitation for ${email}` : `${actor} cancelled an invitation`;
    case "store_renamed":
      return `${actor} renamed the store from ${text(detail, "from", "its old name")} to ${text(detail, "to", "a new name")}`;
    // Liminal Bloom's help actions (spec 0.7.1 7.4): the actor is the product, never the admin, and the reason stays in the admin log.
    case "store_paused":
      return `${actor} paused the store`;
    case "store_restored":
      return `${actor} restored the store`;
    case "invitation_accepted":
      return `${actor} joined as ${role}`;
    default:
      return `${actor} made a change`;
  }
}
