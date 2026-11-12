// What a dialog says when the server refuses a change to roles (spec 0.7, 4.8 part 7).
// `stale` means the dialog's picture is out of date for good: its button turns off and
// closing it reloads the screen and drops staged edits. The others can be fixed in place.

import { nestingText, type NestingProblem } from "@/lib/access/nesting";

export { NETWORK_TEXT } from "@/components/people/refusal-text";

export type RoleRefusalLike =
  | { status: "forbidden" | "stale" | "gone" | "invalid" | "taken" | "rank" | "grant" | "locked" | "empty-name" | "long-name" | "cant-move-people" | "people-changed" }
  | { status: "nesting"; problem: NestingProblem };

export type RefusalContext = {
  /** The role the dialog is about (or "A role" for a batch). */
  role: string;
  /** The name that was taken, for "Another role is already called ...". */
  name?: string;
  /** The dialog is Reset or Delete, whose rank and grant lines read differently. */
  action?: "reset" | "delete" | "add";
};

export function refusalText(result: RoleRefusalLike, { role, name, action }: RefusalContext): { message: string; stale: boolean } {
  switch (result.status) {
    case "forbidden":
      return { message: "Your role can't do this anymore.", stale: true };
    case "stale":
      return { message: `${role} changed meanwhile, so nothing was saved. Close and look again.`, stale: true };
    case "gone":
      return { message: `${role} was deleted meanwhile. Close and look again.`, stale: true };
    case "invalid":
      return { message: "That isn't available anymore. Close and look again.", stale: true };
    case "locked":
      return { message: "Store Manager always keeps this permission.", stale: true };
    case "taken":
      return { message: `Another role is already called ${name ?? "that"}.`, stale: false };
    case "empty-name":
      return { message: "Enter a name.", stale: false };
    case "long-name":
      return { message: "Keep the name to 40 characters.", stale: false };
    case "rank":
      return { message: action === "delete" ? "You can move people only into a role below your own." : "You can place roles only below your own.", stale: false };
    case "grant":
      return { message: action === "reset" ? "Resetting would change a permission your role doesn't have." : "You can't change a permission your role doesn't have.", stale: false };
    case "cant-move-people":
      return { message: "Your role can't move people. Ask someone who manages people.", stale: false };
    case "people-changed":
      return { message: "Someone joined or left this role meanwhile. Check the list.", stale: false };
    case "nesting":
      return { message: nestingText(result.problem, action === "add"), stale: false };
  }
}
