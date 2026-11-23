// The user menu's Help item, with the reply count when there is one. Pure, so the menu (a client component)
// and its tests share it.

export function helpLabel(replies: number): string {
  return replies > 0 ? `Help · ${replies} ${replies === 1 ? "reply" : "replies"}` : "Help";
}
