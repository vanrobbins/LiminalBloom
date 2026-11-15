// What a dialog says when the server refuses a change to a person (spec 0.7,
// 4.8 part 4). `stale` means the dialog's picture of the person is out of date for
// good: its button turns off and closing it reloads the list.

export type PersonRefusal = "forbidden" | "stale" | "gone" | "invalid" | "last-manager";

export function refusalText(status: PersonRefusal, name: string): { message: string; stale: boolean } {
  switch (status) {
    case "forbidden":
      return { message: "Your role can't do this anymore.", stale: true };
    case "stale":
      return { message: `${name}'s role changed meanwhile. Close and look again.`, stale: true };
    case "gone":
      return { message: `${name} isn't in this store anymore. Close and look again.`, stale: true };
    case "invalid":
      return { message: "That role isn't available. Close and look again.", stale: true };
    case "last-manager":
      return { message: "A store always keeps one Store Manager.", stale: false };
  }
}

export const NETWORK_TEXT = "Couldn't save. Check your connection and try again.";
