// The disposable development accounts (docs/STATUS.md). Each Playwright worker
// has its own account and stores, so workers never touch each other's data:
// worker 0 is the account in STATUS, and setup creates the others. Each owns a
// home store and a second, empty store so store switching can be tested.

/** How many workers run at once; setup prepares one account for each. */
export const E2E_WORKERS = Number(process.env.E2E_WORKERS ?? 4);

export function accountFor(worker: number) {
  return worker === 0
    ? { email: "test.associate@example.com", password: "correct-horse-battery" }
    : { email: `e2e.worker${worker}@example.com`, password: "correct-horse-battery" };
}

export const authFileFor = (worker: number) => `playwright/.auth/user-${worker}.json`;

/** Better Auth limits sign-ins per IP, so each worker gets its own (production builds only). */
export const ipFor = (worker: number) => `10.0.0.${worker + 1}`;

/** This worker's account. Playwright sets the index in every worker process. */
export const TEST_ACCOUNT = accountFor(Number(process.env.TEST_PARALLEL_INDEX ?? 0));

export const HOME_STORE = "Pioneer Place";
export const SECOND_STORE = "E2E Second Store";
