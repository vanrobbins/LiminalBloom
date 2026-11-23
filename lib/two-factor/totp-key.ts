// The setup key an authenticator app asks for, taken from the otpauth link Better Auth returns.
// Pure, so the setup screen and its tests share it.

/** The `secret` of an otpauth link, or null when there is none. */
export function setupKey(otpauthUri: string): string | null {
  try {
    return new URL(otpauthUri).searchParams.get("secret");
  } catch {
    return null;
  }
}

/** "JBSWY3DP" -> "JBSW Y3DP": groups of four are easier to read out and to type. */
export function groupsOfFour(key: string): string {
  return key.match(/.{1,4}/g)?.join(" ") ?? "";
}
