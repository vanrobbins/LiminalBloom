import ts from "typescript";
import { describe, expect, it } from "vitest";

import { forbiddenProblem } from "./server-actions-forbidden";
import { exportsOf, guardProblem, hasUseServerDirective, isUseServerFile, sourceFiles } from "./server-actions-scan";

// Every exported function in a "use server" file is a public entry point (proposal §8.3,
// spec 0.7 §4.7). Each must start with a switch guard from lib/current-member.ts, so a new
// action cannot ship open. Written as a scan, in the pattern of components/ui/tooltip.test.tsx.
//
// "Start with" is checked, not just "mentions": the guard is awaited at the top level of the
// function body (not in a closure, a branch or the right side of && / ||), and no other await
// comes before it, so nothing can be written or read first.

const GUARD = "requireSwitchForAction";
// Liminal Bloom admin actions (spec 0.7.1 7.2): everything under app/admin awaits the admin guard, whose
// "forbidden" answer is branched on like the switch guard's. The setup and step-up actions are how an admin
// gets a fresh second factor, so they hold the account-level guard (an admin, factor state not asked).
const ADMIN_GUARD = "requirePlatformAdminForAction";
const ACCOUNT_GUARD = "requirePlatformAdminAccountForAction";
// /company's writes (spec 0.7.1 6.2): a company switch, not a store switch, branched on the same way.
const COMPANY_GUARD = "requireCompanyForAction";
const FORBIDDEN_GUARDS = [GUARD, ADMIN_GUARD, ACCOUNT_GUARD, COMPANY_GUARD];
const guardFor = (file: string) => (file.startsWith("app/admin/") ? ADMIN_GUARD : GUARD);

// Files off the plain rule, with reasons: `guard` is awaited instead; `first` lists the only awaits before it, in order.
type Exception = { guard: string; first: string[]; why: string };
const ALLOWED: Record<string, Exception> = {
  "app/create-store/actions.ts": { guard: "getCurrentMember", first: [], why: "store creation happens before the person has a store or a role, so there is no switch to hold; getCurrentMember is read first so a person whose role requires two-factor and who has none yet is refused (A3b)" },
  "app/invite/[id]/actions.ts": { guard: "getSession", first: ["headers"], why: "accepting is how a person with no store or role gets one; the session (its person and email) is the check, and the invitation must name that email. A person who still needs two-factor (needs-two-factor) may accept on purpose: the requirement is per store and role, so joining a store whose role does not require it is fine, and the new store's own requirement is enforced the next time that store is active" },
  "app/(app)/account/actions.ts": { guard: "requireAccountPerson", first: [], why: "changing your own password is for any signed-in member whatever their role, so there is no switch to hold; a person whose stores are all paused keeps their password (DECISIONS 11-23), so requireMember would send them away. requireAccountPerson redirects a signed-out visitor before anything is read" },
  "app/(app)/account/two-factor-actions.ts": { guard: "requireAccountPerson", first: [], why: "two-step sign-in is for any signed-in account whatever its role, and a person whose role requires it but who has none yet is who calls these: requireMember would send exactly them away. requireAccountPerson redirects a signed-out visitor before anything is read" },
  "app/(app)/account/passkey-actions.ts": { guard: "requireAccountPerson", first: [], why: "passkeys are for any signed-in account whatever its role, and a person whose role requires two-factor and who has none yet is who adds one (a passkey counts): requireMember would send exactly them away. requireAccountPerson redirects a signed-out visitor before anything is read" },
  "app/(app)/switch-store-actions.ts": { guard: "requireAccountPerson", first: [], why: "switching is for any signed-in person who reaches the store, and a person whose role still needs two-factor may move to another of their stores (DECISIONS 11-23), so requireMember would send exactly them away. setActiveStore does the real check: it refuses a store they do not reach today. requireAccountPerson redirects a signed-out visitor before anything is read" },
  "app/(app)/help/actions.ts": { guard: "requireSignedIn", first: [], why: "Help is for any signed-in account, and the people who most need it have no store, no role or only paused stores (spec 0.7.1 9.3), so there is no switch to hold. requireSignedIn redirects a signed-out visitor before anything is read; every statement then filters by the session's own person, and the context is built on the server" },
  "app/(app)/company/actions.ts": { guard: COMPANY_GUARD, first: [], why: "company writes hold a company switch (company.settings or company.structure) from the session, not a store switch: a company person may have no store at all. requireCompanyForAction redirects a signed-out visitor before anything is read" },
  "app/(app)/company/store-actions.ts": { guard: COMPANY_GUARD, first: [], why: "adding a store holds company.structure from the session, and a company person may have no store yet; the company is the person's own, never the browser's. requireCompanyForAction redirects a signed-out visitor before anything is read" },
  "app/(app)/request-company/actions.ts": { guard: "requireSignedIn", first: [], why: "asking for a company is for any signed-in account, and the people who ask are mostly the ones with no store (spec 0.7.1 5.1), so there is no switch to hold. requireSignedIn redirects a signed-out visitor before anything is read; every statement then filters by the session's own person" },
  "app/admin/two-factor/actions.ts": { guard: ACCOUNT_GUARD, first: [], why: "setting up two-step sign-in is for an admin who does not have it yet, so the full admin guard (which wants a fresh factor) would refuse the one person who needs these" },
  "app/admin/verify/actions.ts": { guard: ACCOUNT_GUARD, first: [], why: "the step-up is how an admin with a missing or stale factor gets a fresh one, so the full admin guard would refuse the one person who needs it" },
  "app/(editor)/layout/edit/actions.ts": { guard: GUARD, first: ["getCurrentMember"], why: "the editor answers signed-out itself (its last change was not saved; the guard would redirect), so one getCurrentMember() comes first" },
};

describe("server actions are guarded (spec 0.7 §4.7)", () => {
  const everything = sourceFiles();
  const files = everything.filter(({ file, source }) => file.startsWith("app/") && isUseServerFile(source));

  it("finds the action files, so the scan cannot pass by looking at nothing", () => {
    const names = files.map((f) => f.file);
    for (const expected of ["app/(app)/store/actions.ts", "app/(app)/store/people-actions.ts", "app/(app)/store/roles/actions.ts", "app/(app)/products/status-actions.ts", "app/(app)/planograms/actions.ts", "app/(app)/planograms/adjust-actions.ts", "app/(editor)/layout/edit/actions.ts", "app/create-store/actions.ts", "app/admin/two-factor/actions.ts", "app/admin/two-factor/codes-actions.ts", "app/admin/verify/actions.ts", "app/(app)/help/actions.ts"]) {
      expect(names).toContain(expected);
    }
  });

  it("every exported action awaits requireSwitchForAction first (the allow-list is named, with its reason)", () => {
    const offenders = files.flatMap(({ file, source }) =>
      exportsOf(source).flatMap(({ name, fn, problem }) => {
        const { guard, first } = ALLOWED[file] ?? { guard: guardFor(file), first: [] };
        if (fn === null) return [`${file}: ${name} ${problem ?? "is not an async function the scan can check"}`];
        // Every awaited switch guard, not only the first, must be branched on (a second guard that depends on the data is the easy one to leave open).
        const why = guardProblem(fn, guard, first) ?? FORBIDDEN_GUARDS.map((g) => forbiddenProblem(fn, g)).find((p) => p !== null) ?? null;
        return why ? [`${file}: ${name} ${why}`] : [];
      }),
    );
    expect(offenders).toEqual([]);
  });

  it("no other source file has a \"use server\" directive the scan above did not check", () => {
    const checked = new Set(files.map((f) => f.file));
    const offenders = everything.filter(({ file, source }) => !checked.has(file) && hasUseServerDirective(source)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it("the allow-list holds only files that exist and still use \"use server\"", () => {
    for (const file of Object.keys(ALLOWED)) expect(files.map((f) => f.file)).toContain(file);
  });
});

describe("the forbidden-branch scan", () => {
  const problemIn = (body: string) => {
    const source = ts.createSourceFile("snippet.ts", `export async function act() {
${body}
}`, ts.ScriptTarget.Latest, true);
    return forbiddenProblem(exportsOf(source)[0].fn!, GUARD);
  };

  it("accepts a guard branched on in a variable or inline, whichever way round", () => {
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status === "forbidden") return 1;`)).toBeNull();
    expect(problemIn(`if ((await ${GUARD}("a")).status === "forbidden") return 1;`)).toBeNull();
    expect(problemIn(`const c = await ${GUARD}("a"); if ("forbidden" === c.status) return 1;`)).toBeNull();
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status === "forbidden") { log(); return 1; }`)).toBeNull();
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status === "forbidden") throw new Error("no");`)).toBeNull();
  });

  it("flags a second guard whose answer is never compared, and one thrown away", () => {
    expect(problemIn(`const a = await ${GUARD}("a"); if (a.status === "forbidden") return 1; const b = await ${GUARD}("b");`)).toContain("never checks b.status");
    expect(problemIn(`const a = await ${GUARD}("a"); if (a.status === "forbidden") return 1; await ${GUARD}("b");`)).toContain("without checking its status");
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status === "ok") return 1;`)).toContain("never checks c.status");
  });

  it("accepts the comparison in a ternary, behind a !, with the matching else, or joined only by ||", () => {
    expect(problemIn(`const c = await ${GUARD}("a"); return c.status === "forbidden" ? 1 : 2;`)).toBeNull();
    expect(problemIn(`const c = await ${GUARD}("a"); if (!(c.status !== "forbidden")) return 1;`)).toBeNull();
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status !== "forbidden") { work(); } else return 1;`)).toBeNull();
    expect(problemIn(`const c = await ${GUARD}("a"); if (x || c.status === "forbidden") return 1;`)).toBeNull();
    expect(problemIn(`if (x && (await ${GUARD}("a")).status === "forbidden") return 1;`)).toBeNull(); // the guard itself only runs when x holds
  });

  it("flags a comparison that does not alone decide the refusal: && with a variable, a taken branch that carries on, a missing else", () => {
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status === "forbidden" && x) return 1;`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); if (x && c.status === "forbidden") return 1;`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status === "forbidden") { log(); }`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status === "forbidden") log(); else return 1;`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status !== "forbidden") return 1;`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status !== "forbidden") { work(); } else { log(); }`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); if (c.status !== "forbidden" || x) return 1;`)).toContain("never checks c.status");
    expect(problemIn(`if ((await ${GUARD}("a")).status === "forbidden" && x) return 1;`)).toContain("never branches on it");
    expect(problemIn(`const c = await ${GUARD}("a"); const v = c.status === "forbidden" ? 1 : 2; work(); return v;`)).toContain("never checks c.status");
  });

  it("flags the variable and switch forms on purpose: the check must be an inline if or ternary on .status", () => {
    expect(problemIn(`const c = await ${GUARD}("a"); const gone = c.status === "forbidden"; if (gone) return 1;`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); switch (c.status) { case "forbidden": return 1; }`)).toContain("never checks c.status");
  });

  it("flags a comparison that is not the condition of an if or ternary: assigned, passed on, or returned as it is", () => {
    expect(problemIn(`const c = await ${GUARD}("a"); const gone = c.status === "forbidden"; return 1;`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); log(c.status === "forbidden"); return 1;`)).toContain("never checks c.status");
    expect(problemIn(`const c = await ${GUARD}("a"); return c.status === "forbidden";`)).toContain("never checks c.status");
    expect(problemIn(`const gone = (await ${GUARD}("a")).status === "forbidden"; return 1;`)).toContain("never branches on it");
  });

  it("flags a guard whose answer is only checked before it was awaited, such as an earlier variable of the same name", () => {
    expect(problemIn(`{ const c = await ${GUARD}("a"); if (c.status === "forbidden") return 1; } { const c = await ${GUARD}("b"); return 2; }`)).toContain("never checks c.status");
  });
});
