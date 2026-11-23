import { describe, expect, it } from "vitest";
import ts from "typescript";

import { sourceFiles } from "../server-actions-scan";

// An admin never reads or changes a store's own data (spec 0.7.1 7.2 and 7.6, DECISIONS 11-11): admin
// screens show names, emails, roles, counts and dates. Everything under app/admin, components/admin and
// lib/admin is scanned for an import of the store-data layer: `withStore` (row-level security, the only
// way into the map and product tables) and the four libraries that sit on it. An admin's own stores are
// reached the normal way, as a member, with the shell. Written as a scan, in the pattern of
// server-actions-guard.test.ts. Accepted gap: a non-literal `import(path)` is not seen.

const ROOTS = ["app/admin/", "components/admin/", "lib/admin/"];
const FORBIDDEN = ["lib/db/with-store", "lib/products", "lib/planograms", "lib/layout", "lib/home"];

/** The module an import, re-export, `import()` or `require()` names, when it is written as a string. */
function moduleOf(n: ts.Node): string | null {
  if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) return n.moduleSpecifier.text;
  if (!ts.isCallExpression(n)) return null;
  const [arg] = n.arguments;
  const dynamic = n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require");
  return dynamic && arg && ts.isStringLiteralLike(arg) ? arg.text : null;
}

/** The repo path a module string reaches (`@/x` or a relative path), without extension or a trailing `/index`. */
export function repoPath(spec: string, file: string): string | null {
  const joined = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? new URL(spec, `file:///${file}`).pathname.slice(1) : null;
  return joined === null ? null : joined.replace(/\.[cm]?[jt]sx?$/, "").replace(/\/index$/, "");
}

const reaches = (path: string) => FORBIDDEN.some((f) => path === f || path.startsWith(`${f}/`) || path.startsWith(`${f}-`));

/** Every line of `source` that imports store data, or names `withStore` as an identifier (a copy of the function would do the same). */
export function storeDataLines(source: ts.SourceFile, file: string): number[] {
  const lines: number[] = [];
  const line = (n: ts.Node) => source.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visit = (n: ts.Node) => {
    const spec = moduleOf(n);
    const path = spec === null ? null : repoPath(spec, file);
    if (path !== null && reaches(path)) lines.push(line(n));
    if (ts.isIdentifier(n) && n.text === "withStore") lines.push(line(n));
    ts.forEachChild(n, visit);
  };
  visit(source);
  return lines;
}

describe("the admin area reads no store data (spec 0.7.1 7.2)", () => {
  const scanned = sourceFiles().filter(({ file }) => ROOTS.some((root) => file.startsWith(root)));

  it("finds files under every root, so the scan cannot pass by looking at nothing", () => {
    for (const root of ROOTS) expect(scanned.some(({ file }) => file.startsWith(root)), root).toBe(true);
  });

  it("imports no withStore, products, planograms, layout or home code", () => {
    const offenders = scanned.flatMap(({ file, source }) => storeDataLines(source, file).map((n) => `${file}:${n}`));
    expect(offenders).toEqual([]);
  });

  it("sees each way in (the scan's own check)", () => {
    const code = [
      'import { withStore } from "@/lib/db/with-store";',
      'import { x } from "../../lib/products/queries";',
      'export { y } from "@/lib/planograms";',
      'const z = await import("@/lib/home/cards");',
      'import { fine } from "@/lib/admin/reads";',
    ].join("\n");
    const found = storeDataLines(ts.createSourceFile("lib/admin/x.ts", code, ts.ScriptTarget.Latest, true), "lib/admin/x.ts");
    expect(found).toEqual([1, 1, 2, 3, 4]);
  });
});
