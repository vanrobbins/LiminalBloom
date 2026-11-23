// npm run admin:grant -- <email>                         → development
// npm run admin:grant:prod -- <email>                    → production (Van only; asks first)
//   add --reset-two-factor to reset an admin who lost both their app and their backup codes
// The first Liminal Bloom admin is made here; after that admins add each other on /admin/admins (spec 0.7.1 7.1).

import { createInterface } from "node:readline/promises";

import { config } from "dotenv";

import { confirmPhrase, parseArgs } from "./platform-admin-args";

config({ path: ".env.local", quiet: true });

async function confirm(message: string, phrase: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(message);
  prompt.close();
  return answer.trim() === phrase;
}

// Inside the try, so a mistake is a one-line message and a failed exit, not a stack trace.
try {
  const command = parseArgs(process.argv.slice(2));
  if ("error" in command) throw new Error(command.error);

  if (command.prod) {
    // Before @/db is imported: the connection is made at import time.
    const { switchToProduction } = await import("./seed-demo/target");
    switchToProduction();
  }
  const where = command.prod ? "PRODUCTION" : "development";
  const what = command.action === "grant" ? `make ${command.email} a Liminal Bloom admin` : `reset two-step sign-in for ${command.email} and sign them out everywhere`;
  if (command.prod) {
    const phrase = confirmPhrase(command.action);
    if (!(await confirm(`On ${where}: ${what}.\nType "${phrase}" to go on: `, phrase))) {
      console.log("Stopped. Nothing changed.");
      process.exit(0);
    }
  }

  const { grantAdmin, resetTwoFactor } = await import("./platform-admin-run");
  if (command.action === "grant") {
    const { status } = await grantAdmin(command.email);
    console.log(status === "granted" ? `${where}: ${command.email} is now a Liminal Bloom admin. They set up two-step sign-in at /admin.` : `${where}: ${command.email} already is a Liminal Bloom admin.`);
  } else {
    await resetTwoFactor(command.email);
    console.log(`${where}: two-step sign-in reset for ${command.email}. They sign in with their password and set it up again at /admin.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
