// The disposable development accounts (docs/STATUS.md). Each Playwright worker
// has its own account and stores, so workers never touch each other's data:
// worker 0 is the account in STATUS, and setup creates the others. Each owns a
// home store and a second, empty store so store switching can be tested.

import type { BuiltinRoleKey } from "../lib/access/roles";

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

// One account per built-in role, all in one shared store (plan 0.7.0 task 12), so a spec can sign in as a
// role and see what it sees. Setup creates them; the Store Manager account makes the store and the others
// are added to it with their role. No spec changes this store's people or roles, so workers share it.
export const ROLE_STORE = "E2E Roles Store";
export const ROLE_KEYS: BuiltinRoleKey[] = ["store_manager", "assistant_manager", "vm_manager", "vm_worker", "sales_associate"];

/** What each role's person is called on the People screen. */
export const ROLE_PEOPLE: Record<BuiltinRoleKey, string> = {
  store_manager: "Mara Manager",
  assistant_manager: "Ada Assistant",
  vm_manager: "Vera Visual",
  vm_worker: "Walt Worker",
  sales_associate: "Sal Sales",
};

export const roleAccount = (key: BuiltinRoleKey) => ({ email: `e2e.role.${key.replace(/_/g, "-")}@example.com`, password: "correct-horse-battery", name: ROLE_PEOPLE[key] });
export const roleAuthFile = (key: BuiltinRoleKey) => `playwright/.auth/role-${key}.json`;
/** Setup signs the five in one after another, each from its own address, for the sign-in limit. */
export const roleIp = (key: BuiltinRoleKey) => `10.8.0.${ROLE_KEYS.indexOf(key) + 1}`;
