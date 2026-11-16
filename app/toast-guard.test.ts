import ts from "typescript";
import { describe, expect, it } from "vitest";

import { sourceFiles } from "./server-actions-scan";

// R2 (0.7.0.5): a toast is for a result that is out of sight, a long task, a save, or a lost
// connection. A quick action shows its result where the person is looking, and its refusal beside
// the control, so a new `toast(` call has to be argued for. This lists every call site allowed
// (file, how many calls, and why) and fails on any other, in the pattern of server-actions-guard.test.ts.
// Adding a call means adding it here on purpose, with its reason.

type Allowed = { calls: number; why: string };

const CONNECTION = "a lost connection (\"Check the connection and try again\")";
const ALLOWED: Record<string, Allowed> = {
  "app/(app)/account/change-password-form.tsx": { calls: 1, why: "password change: the result is not where the person is looking (a form that resets)" },
  "components/invite/accept-button.tsx": { calls: 1, why: "accepting an invitation navigates away, so the confirmation must outlive the page" },
  "components/people/invitations-card.tsx": { calls: 1, why: CONNECTION },
  "components/planograms/corner-bar.tsx": { calls: 2, why: `discard draft (a long, final task), and ${CONNECTION}` },
  "components/planograms/publish-body.tsx": { calls: 2, why: `publish (a long task whose result is out of sight), and ${CONNECTION}` },
  "components/planograms/restore-button.tsx": { calls: 2, why: `restore a version, and ${CONNECTION}` },
  "components/planograms/start-planogram.tsx": { calls: 2, why: `the empty box has no status line, so a refusal and ${CONNECTION} are toasts` },
  "components/planograms/use-builder.ts": { calls: 1, why: CONNECTION },
  "components/planograms/use-planogram-draft.ts": { calls: 1, why: CONNECTION },
  "components/products/category-form.tsx": { calls: 1, why: "a category changed on another device, told in the form's dialog" },
  "components/products/delete-product-button.tsx": { calls: 4, why: "deleting a product navigates away, so its result is a toast" },
  "components/products/product-form.tsx": { calls: 6, why: "the product form is long and saves with a button: its result, its refusals and \"Saved, but the image wasn't\"" },
  "components/roles/use-move-role.ts": { calls: 1, why: CONNECTION },
  "components/roles/roles-screen.tsx": { calls: 1, why: "the batch Save, Add, Rename, Reset and Delete dialogs close on their result, which is a toast" },
  "components/search/status-control.tsx": { calls: 1, why: CONNECTION },
  "components/shell/use-sign-out.ts": { calls: 1, why: "a failed sign-out, which stays put" },
  "components/shell/use-switch-store.ts": { calls: 1, why: "a failed store switch" },
  "components/ui/use-inline-save.ts": { calls: 1, why: `the due date, store name and time zone save as they change; only ${CONNECTION} is a toast` },
  "components/store-map/use-map-editor.ts": { calls: 1, why: "too many changes to save at once: an explanation with a how-to" },
};

/** The line of every call to a function named `toast`, and every way of getting one under another name. */
function toastUses(source: ts.SourceFile) {
  const calls: number[] = [];
  const aliases: number[] = [];
  const line = (n: ts.Node) => source.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "toast") calls.push(line(n));
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === "@/lib/toast") {
      const bindings = n.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) if (el.propertyName?.text === "toast") aliases.push(line(n));
      if (bindings && ts.isNamespaceImport(bindings)) aliases.push(line(n));
    }
    ts.forEachChild(n, visit);
  };
  visit(source);
  return { calls, aliases };
}

describe("toasts are kept for what is out of sight (R2, 0.7.0.5)", () => {
  const found = sourceFiles()
    .filter(({ file }) => file !== "lib/toast.ts")
    .map(({ file, source }) => ({ file, ...toastUses(source) }));

  it("finds the call sites, so the scan cannot pass by looking at nothing", () => {
    const used = found.filter((f) => f.calls.length > 0).map((f) => f.file);
    for (const expected of ["components/planograms/publish-body.tsx", "components/products/product-form.tsx", "app/(app)/account/change-password-form.tsx"]) expect(used).toContain(expected);
  });

  it("every file calls toast() exactly as often as it is allowed to, and no other file calls it", () => {
    const offenders = found.flatMap(({ file, calls }) => {
      const allowed = ALLOWED[file]?.calls ?? 0;
      return calls.length === allowed ? [] : [`${file}: ${calls.length} toast() call(s) at line(s) ${calls.join(", ") || "none"}, ${allowed} allowed`];
    });
    expect(offenders).toEqual([]);
  });

  it("nothing hides a toast behind another name (an alias or a namespace import)", () => {
    expect(found.filter((f) => f.aliases.length > 0).map((f) => `${f.file}: line ${f.aliases.join(", ")}`)).toEqual([]);
  });

  it("the allow-list holds only files that exist and still call toast(), each with its reason", () => {
    for (const [file, { calls, why }] of Object.entries(ALLOWED)) {
      expect(found.find((f) => f.file === file)?.calls.length, file).toBeGreaterThan(0);
      expect(calls).toBeGreaterThan(0);
      expect(why.length).toBeGreaterThan(10);
    }
  });
});
