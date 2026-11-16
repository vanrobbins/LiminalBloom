// The parsing behind toast-guard.test.ts: every way a source file can reach the toast function.
// Lines are 1-based. `calls` are bare toast() calls; the rest are ways round counting them.
import path from "node:path";

import ts from "typescript";

export type ToastUses = { calls: number[]; aliases: number[]; imports: number[]; sonner: number[]; reexports: number[]; references: number[] };

const TOAST_MODULE = "lib/toast";

/** Whether `spec`, written in `file`, names the toast module (by the @/ alias or a relative path, with or without an extension). */
function isToastModule(spec: string, file: string) {
  const repoPath = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? path.posix.join(path.posix.dirname(file), spec) : null;
  return repoPath !== null && repoPath.replace(/\.[cm]?[jt]sx?$/, "") === TOAST_MODULE;
}

/** The module string of `import x from "m"`, `export … from "m"`, `import("m")` and `require("m")`, or null. */
function moduleOf(n: ts.Node): string | null {
  if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) return n.moduleSpecifier.text;
  const callee = ts.isCallExpression(n) ? n.expression : null;
  const [arg] = ts.isCallExpression(n) ? n.arguments : [];
  const dynamic = callee && (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require"));
  return dynamic && arg && ts.isStringLiteralLike(arg) ? arg.text : null;
}

/** An identifier that only names something (a property, a key, a declaration, an import) rather than reading the value. */
function isNameOnly(id: ts.Identifier) {
  const p = id.parent;
  return (
    ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) || ts.isCallExpression(p) && p.expression === id ||
    (ts.isPropertyAccessExpression(p) && p.name === id) ||
    ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isJsxAttribute(p) || ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isBindingElement(p)) && p.name === id)
  );
}

export function toastUses(source: ts.SourceFile, file: string): ToastUses {
  const uses: ToastUses = { calls: [], aliases: [], imports: [], sonner: [], reexports: [], references: [] };
  const line = (n: ts.Node) => source.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const identifiers: ts.Identifier[] = [];
  let importsToast = false;
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "toast") uses.calls.push(line(n));
    const from = moduleOf(n);
    if (from === "sonner" || from?.startsWith("sonner/")) uses.sonner.push(line(n));
    if (from !== null && isToastModule(from, file)) {
      uses.imports.push(line(n));
      if (ts.isExportDeclaration(n)) uses.reexports.push(line(n));
      const clause = ts.isImportDeclaration(n) ? n.importClause : undefined;
      const bindings = clause?.namedBindings;
      if (clause?.name || (bindings && ts.isNamespaceImport(bindings))) uses.aliases.push(line(n));
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if (el.propertyName?.text === "toast") uses.aliases.push(line(n));
          else if (el.name.text === "toast") importsToast = true;
        }
      }
    }
    // `export { toast }` of a binding already imported.
    if (ts.isExportDeclaration(n) && !n.moduleSpecifier && n.exportClause && ts.isNamedExports(n.exportClause) && n.exportClause.elements.some((el) => (el.propertyName ?? el.name).text === "toast")) uses.reexports.push(line(n));
    if (ts.isIdentifier(n) && n.text === "toast") identifiers.push(n);
    ts.forEachChild(n, visit);
  };
  visit(source);
  // Reading the imported function as a value, rather than calling it: `const t = toast`, `run(toast)`, `toast.error()`.
  if (importsToast) for (const id of identifiers) if (!isNameOnly(id) && !ts.isExportSpecifier(id.parent)) uses.references.push(line(id));
  return uses;
}
