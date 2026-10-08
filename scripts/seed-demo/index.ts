// npm run db:seed:demo        → development
// npm run db:seed:demo:prod   → production (Van only; asks first)

import { createInterface } from "node:readline/promises";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const isProduction = process.argv.includes("--prod");

async function confirm(message: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(message);
  prompt.close();
  return answer.trim() === "seed production";
}

// Inside the try, so a missing PRODUCTION_ variable is a one-line message and
// a failed exit, not a stack trace.
try {
  if (isProduction) {
    const { switchToProduction } = await import("./target");
    switchToProduction();
  }
  const { seedDemo } = await import("./run");
  await seedDemo({ isProduction, confirm });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
