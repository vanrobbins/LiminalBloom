// Short stand-ins for names where there is no room for the whole thing: the
// store button on the tablet rail, and the account button's avatar.
//
// Array.from splits by character, not by UTF-16 unit, so an accented letter
// or an emoji is never cut in half.

/** "Pioneer Place" → "PP"; a one-word name gives its first two letters. */
export function storeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? Array.from(words[0])[0] + Array.from(words[1])[0]
      : Array.from(words[0] ?? "").slice(0, 2).join("");
  return letters.toUpperCase();
}

/** The first letter of a person's name, or of their email when it is blank. */
export function personInitial(name: string, email: string): string {
  return (Array.from(name.trim() || email.trim())[0] ?? "").toUpperCase();
}
