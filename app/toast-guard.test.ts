import ts from "typescript";
import { describe, expect, it } from "vitest";

import { sourceFiles } from "./server-actions-scan";
import { toastUses } from "./toast-scan";

// R2 (0.7.0.5): a toast is for a result that is out of sight, a long task, a save, or a lost
// connection. A quick action shows its result where the person is looking, and its refusal beside
// the control, so a new `toast(` call has to be argued for. This lists every call site allowed
// (file, how many calls, and why) and fails on any other, in the pattern of server-actions-guard.test.ts.
// Adding a call means adding it here on purpose, with its reason.
// Accepted gap: the scan reads string literals, so `import(p)` or `require(p)` with a non-literal
// path, then `m.toast({})`, is not seen. Closing it would need type information; review catches it.

type Allowed = { calls: number; why: string };

/** Files that may import the toast module without calling toast(): they show or dismiss what is there. */
const IMPORTERS = new Set(["components/ui/toaster.tsx"]);

const CONNECTION = "a lost connection (\"Check the connection and try again\")";
const ALLOWED: Record<string, Allowed> = {
  "app/(app)/account/change-password-form.tsx": { calls: 1, why: "password change: the result is not where the person is looking (a form that resets)" },
  "components/admin/reason-dialog.tsx": { calls: 1, why: "an admin help action that finishes (pause, restore, sign out everywhere) reloads the page and its result is out of sight; refusals and a lost connection show inline in the dialog" },
  "components/invite/accept-button.tsx": { calls: 1, why: "accepting an invitation navigates away, so the confirmation must outlive the page" },
  "components/people/invitations-card.tsx": { calls: 1, why: CONNECTION },
  "components/planograms/corner-bar.tsx": { calls: 2, why: `discard draft (a long, final task), and ${CONNECTION}` },
  "components/planograms/publish-body.tsx": { calls: 2, why: `publish (a long task whose result is out of sight), and ${CONNECTION}` },
  "components/planograms/revert-adjustment.tsx": { calls: 2, why: `revert a Quick Adjust (the floor changes out of sight, as a restore does), and ${CONNECTION}` },
  "components/planograms/restore-button.tsx": { calls: 2, why: `restore a version, and ${CONNECTION}` },
  "components/planograms/start-planogram.tsx": { calls: 2, why: `the empty box has no status line, so a refusal and ${CONNECTION} are toasts` },
  "components/planograms/use-builder.ts": { calls: 1, why: CONNECTION },
  "components/planograms/use-planogram-draft.ts": { calls: 1, why: CONNECTION },
  "components/products/category-form.tsx": { calls: 1, why: "a category changed on another device, told in the form's dialog" },
  "components/products/delete-product-button.tsx": { calls: 4, why: "deleting a product navigates away, so its result is a toast" },
  "components/products/product-form.tsx": { calls: 6, why: "the product form is long and saves with a button: its result, its refusals and \"Saved, but the image wasn't\"" },
  "components/quick-adjust/adjust-compare.tsx": { calls: 2, why: `publish a Quick Adjust (the floor changes out of sight, as a publish does), and ${CONNECTION}` },
  "components/quick-adjust/discard-adjustment.tsx": { calls: 2, why: `discard a Quick Adjust (a final task whose result is on the next screen), and ${CONNECTION}` },
  "components/quick-adjust/use-adjustment.ts": { calls: 1, why: CONNECTION },
  "components/roles/use-move-role.ts": { calls: 1, why: CONNECTION },
  "components/roles/use-require-two-factor.ts": { calls: 1, why: CONNECTION },
  "components/roles/roles-screen.tsx": { calls: 1, why: "the batch Save, Add, Rename, Reset and Delete dialogs close on their result, which is a toast" },
  "components/search/status-control.tsx": { calls: 1, why: CONNECTION },
  "components/shell/use-sign-out.ts": { calls: 1, why: "a failed sign-out, which stays put" },
  "components/shell/use-switch-store.ts": { calls: 1, why: "a failed store switch" },
  "components/ui/use-inline-save.ts": { calls: 1, why: `the due date, store name and time zone save as they change; only ${CONNECTION} is a toast` },
  "components/store-map/use-map-editor.ts": { calls: 1, why: "too many changes to save at once: an explanation with a how-to" },
};

type Found = { file: string; calls: number[] } & Partial<ReturnType<typeof toastUses>>;

/** The allow-list rule: a file must call toast() exactly as often as `allowed` says (none when it is not listed). */
const callCountOffenders = (found: Found[], allowed: Record<string, Allowed>) =>
  found.flatMap(({ file, calls }) => {
    const count = allowed[file]?.calls ?? 0;
    return calls.length === count ? [] : [`${file}: ${calls.length} toast() call(s) at line(s) ${calls.join(", ") || "none"}, ${count} allowed`];
  });

/** Scans a source string as if it were the file `file`. */
const scan = (code: string, file = "components/x/new-thing.tsx") => toastUses(ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true), file);

describe("the scan sees every way to reach toast (R2 review)", () => {
  const IMPORT = "import { toast } from \"@/lib/toast\";\n";
  it("counts a bare toast() call", () => expect(scan(`${IMPORT}toast({ title: "x" });`).calls).toEqual([2]));
  it("sees an import of sonner, anywhere", () => {
    expect(scan('import { toast } from "sonner";').sonner).toEqual([1]);
    expect(scan('import "sonner";').sonner).toEqual([1]);
    expect(scan('const s = await import("sonner");').sonner).toEqual([1]);
  });
  it("sees an import of the toast module by alias path, relative path, with an extension, or by dynamic import", () => {
    expect(scan('import { dismissToast } from "@/lib/toast";').imports).toEqual([1]);
    expect(scan('import { dismissToast } from "../../../lib/toast";', "components/a/b/x.tsx").imports).toEqual([1]);
    expect(scan('import { dismissToast } from "../lib/toast.ts";', "app/x.tsx").imports).toEqual([1]);
    expect(scan('import "@/lib/toast";').imports).toEqual([1]);
    expect(scan('const m = await import("@/lib/toast");').imports).toEqual([1]);
    expect(scan('import { x } from "@/lib/toaster-thing";').imports).toEqual([]);
    expect(scan('import { x } from "../other/toast";', "components/a/x.tsx").imports).toEqual([]);
  });
  it("sees a re-export of toast, by name, by star, or of the imported binding", () => {
    expect(scan('export { toast } from "@/lib/toast";').reexports).toEqual([1]);
    expect(scan('export * from "@/lib/toast";').reexports).toEqual([1]);
    expect(scan('export { toast as notify } from "../lib/toast";', "app/x.ts").reexports).toEqual([1]);
    expect(scan(`${IMPORT}export { toast };`).reexports).toEqual([2]);
    expect(scan(`${IMPORT}export const t = toast;`).references).toEqual([2]);
  });
  it("sees toast used as a value, not called", () => {
    expect(scan(`${IMPORT}const t = toast;`).references).toEqual([2]);
    expect(scan(`${IMPORT}run(toast);`).references).toEqual([2]);
    expect(scan(`${IMPORT}const o = { toast };`).references).toEqual([2]);
    expect(scan(`${IMPORT}toast.error("x");`).references).toEqual([2]);
    expect(scan(`${IMPORT}(0, toast)({});`).references).toEqual([2]);
  });
  it("does not mistake a property, a key or the import itself for a use", () => {
    expect(scan(`${IMPORT}const o = { toast: 1 }; o.toast; toast({});`).references).toEqual([]);
    expect(scan(`${IMPORT}toast({});`).references).toEqual([]);
    expect(scan("const toast = 1; show(toast);").references).toEqual([]);
  });
});

describe("the allow-list rule itself (fixtures)", () => {
  const listed = { "components/x/a.tsx": { calls: 1, why: "a reason that is long enough" } };
  const A = "components/x/a.tsx";
  const IMPORT = "import { toast } from \"@/lib/toast\";\n";
  it("passes a listed file with exactly its calls", () => expect(callCountOffenders([{ file: A, ...scan(`${IMPORT}toast({});`, A) }], listed)).toEqual([]));
  it("fails an unlisted file that calls toast()", () => expect(callCountOffenders([{ file: "components/x/b.tsx", ...scan(`${IMPORT}toast({});`) }], listed)).toHaveLength(1));
  it("fails a listed file with one call too many, and one too few", () => {
    expect(callCountOffenders([{ file: A, ...scan(`${IMPORT}toast({}); toast({});`, A) }], listed)).toHaveLength(1);
    expect(callCountOffenders([{ file: A, ...scan("const a = 1;", A) }], listed)).toHaveLength(1);
  });
  it("lets a file with no calls and no listing alone", () => expect(callCountOffenders([{ file: "components/x/c.tsx", ...scan("const a = 1;") }], listed)).toEqual([]));
});

describe("toasts are kept for what is out of sight (R2, 0.7.0.5)", () => {
  const found = sourceFiles()
    .filter(({ file }) => file !== "lib/toast.ts")
    .map(({ file, source }) => ({ file, ...toastUses(source, file) }));

  it("finds the call sites, so the scan cannot pass by looking at nothing", () => {
    const used = found.filter((f) => f.calls.length > 0).map((f) => f.file);
    for (const expected of ["components/planograms/publish-body.tsx", "components/products/product-form.tsx", "app/(app)/account/change-password-form.tsx"]) expect(used).toContain(expected);
  });

  it("every file calls toast() exactly as often as it is allowed to, and no other file calls it", () => {
    expect(callCountOffenders(found, ALLOWED)).toEqual([]);
  });

  it("nothing hides a toast behind another name (an alias or a namespace import)", () => {
    expect(found.filter((f) => f.aliases.length > 0).map((f) => `${f.file}: line ${f.aliases.join(", ")}`)).toEqual([]);
  });

  it("sonner is imported nowhere", () => {
    expect(found.filter((f) => f.sonner.length > 0).map((f) => `${f.file}: line ${f.sonner.join(", ")}`)).toEqual([]);
  });

  it("only the allow-listed files (and the Toaster) import the toast module, and none re-export it", () => {
    const offenders = found.flatMap(({ file, imports, reexports }) => {
      const out = reexports.length > 0 ? [`${file}: re-exports toast at line(s) ${reexports.join(", ")}`] : [];
      return imports.length > 0 && !(file in ALLOWED) && !IMPORTERS.has(file) ? [...out, `${file}: imports the toast module at line(s) ${imports.join(", ")}`] : out;
    });
    expect(offenders).toEqual([]);
  });

  it("toast is never used as a value (assigned, passed along, or reached through a property)", () => {
    expect(found.filter((f) => f.references.length > 0).map((f) => `${f.file}: line ${f.references.join(", ")}`)).toEqual([]);
  });

  it("the allow-list holds only files that exist and still call toast(), each with its reason", () => {
    for (const [file, { calls, why }] of Object.entries(ALLOWED)) {
      expect(found.find((f) => f.file === file)?.calls.length, file).toBeGreaterThan(0);
      expect(calls).toBeGreaterThan(0);
      expect(why.length).toBeGreaterThan(10);
    }
  });
});
