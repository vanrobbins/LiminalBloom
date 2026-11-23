// The command line of scripts/platform-admin.ts, as pure functions so it tests without a database:
//   npm run admin:grant -- <email>                          make an account a Liminal Bloom admin (development)
//   npm run admin:grant:prod -- <email>                     the same on production (asks for a typed phrase)
//   npm run admin:grant -- --reset-two-factor <email>       an admin who lost the app and the backup codes
//   npm run admin:grant:prod -- --reset-two-factor <email>  the same on production

export type Command = { action: "grant" | "reset-two-factor"; email: string; prod: boolean };

/** The command, or the one-line reason there is none. */
export function parseArgs(argv: readonly string[]): Command | { error: string } {
  const flags = argv.filter((a) => a.startsWith("--"));
  const words = argv.filter((a) => !a.startsWith("--"));
  const unknown = flags.find((f) => f !== "--prod" && f !== "--reset-two-factor");
  if (unknown) return { error: `Unknown option ${unknown}. Options: --prod, --reset-two-factor.` };
  if (words.length !== 1) return { error: "Give exactly one email address: npm run admin:grant -- <email>" };
  const email = words[0].trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: `"${words[0]}" is not an email address.` };
  return { action: flags.includes("--reset-two-factor") ? "reset-two-factor" : "grant", email, prod: flags.includes("--prod") };
}

/** What must be typed before a production run goes ahead (like `seed production` for the demo seed). */
export function confirmPhrase(action: Command["action"]): string {
  return action === "grant" ? "grant admin production" : "reset two-factor production";
}
