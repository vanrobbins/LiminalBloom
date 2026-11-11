import { readdirSync, readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// Every exported function in a "use server" file is a public entry point (proposal §8.3,
// spec 0.7 §4.7). Each must start with a switch guard from lib/current-member.ts, so a new
// action cannot ship open. Written as a scan, in the pattern of components/ui/tooltip.test.tsx.
//
// "Start with" is checked, not just "mentions": the guard is awaited at the top level of the
// function body (not in a closure, a branch or the right side of && / ||), and no other await
// comes before it, so nothing can be written or read first.

const GUARD = "requireSwitchForAction";

// Files off the plain rule, with reasons: `guard` is awaited instead; `first` lists the only awaits before it, in order.
type Exception = { guard: string; first: string[]; why: string };
const ALLOWED: Record<string, Exception> = {
  "app/create-store/actions.ts": { guard: "getSession", first: ["headers"], why: "store creation happens before the person has a store or a role; the session needs the request headers" },
  "app/(editor)/layout/edit/actions.ts": { guard: GUARD, first: ["getCurrentMember"], why: "the editor answers signed-out itself (its last change was not saved; the guard would redirect), so one getCurrentMember() comes first" },
};

const SCANNED_ROOTS = ["app", "lib", "components"];

function sourceFiles() {
  return SCANNED_ROOTS.flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .map((file) => `${root}/${file.replaceAll("\\", "/")}`)
      .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test.") && !file.endsWith(".d.ts"))
      .map((file) => ({ file, source: ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true) })),
  );
}

const isUseServer = (node: ts.Node) => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === "use server";

/** Files whose first statement is the directive (comments before it are trivia, so it is still first). */
function isUseServerFile(source: ts.SourceFile) {
  const first = source.statements[0];
  return first !== undefined && isUseServer(first);
}

/** Whether a "use server" statement sits anywhere in the file: file-level, inside a function, or misplaced. */
function hasUseServerDirective(source: ts.SourceFile) {
  let found = false;
  const visit = (n: ts.Node) => {
    if (isUseServer(n)) found = true;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(source);
  return found;
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
const isExported = (node: ts.Node) => hasModifier(node, ts.SyntaxKind.ExportKeyword);
const isAsync = (node: ts.Node) => hasModifier(node, ts.SyntaxKind.AsyncKeyword);

type FunctionNode = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;

const unwrap = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e) ? unwrap(e.expression) : e);

/** The async function an expression is, if it is one. */
function asyncFunctionOf(expression: ts.Expression | undefined): FunctionNode | null {
  const e = expression && unwrap(expression);
  return e && (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) && isAsync(e) ? e : null;
}

type Exported = { name: string; fn: FunctionNode | null; problem?: string };

/** Every exported value in the file, with the async function to check, or none with the reason it cannot be checked. */
function exportsOf(source: ts.SourceFile): Exported[] {
  // Local functions by name, so `export { x }` and `export default x` can be followed to their code.
  const locals = new Map<string, FunctionNode | null>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) locals.set(statement.name.text, isAsync(statement) ? statement : null);
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) locals.set(d.name.text, asyncFunctionOf(d.initializer));
    }
  }
  const local = (name: string): Exported => (locals.has(name) ? { name, fn: locals.get(name) ?? null } : { name, fn: null, problem: "is not a function declared in this file" });

  return source.statements.flatMap((statement): Exported[] => {
    // Overload signatures have no body; the implementation is checked on its own.
    if (ts.isFunctionDeclaration(statement) && isExported(statement) && statement.body) {
      return [{ name: hasModifier(statement, ts.SyntaxKind.DefaultKeyword) ? "default" : (statement.name?.text ?? "default"), fn: isAsync(statement) ? statement : null }];
    }
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      return statement.declarationList.declarations.map((d) => ({ name: d.name.getText(), fn: asyncFunctionOf(d.initializer) }));
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      // `export { x } from "./other"` and `export * from` hide code in another file.
      if (statement.moduleSpecifier || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
        return [{ name: statement.getText(), fn: null, problem: "re-exports code the scan cannot follow" }];
      }
      return statement.exportClause.elements.filter((el) => !el.isTypeOnly).map((el) => ({ ...local((el.propertyName ?? el.name).text), name: el.name.text }));
    }
    if (ts.isExportAssignment(statement)) {
      const e = unwrap(statement.expression);
      if (ts.isIdentifier(e)) return [{ ...local(e.text), name: "default" }];
      return [{ name: "default", fn: asyncFunctionOf(e) }];
    }
    // Types vanish at runtime; any other export (class, enum, namespace) is something the scan cannot check.
    const isType = ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement);
    return isExported(statement) && !isType ? [{ name: statement.getText().slice(0, 40), fn: null, problem: "is an export the scan cannot check" }] : [];
  });
}

/** `await name(...)` or `await a.b.name(...)`: the awaited call, whatever its arguments. */
function isAwaitOf(node: ts.Node, name: string): node is ts.AwaitExpression {
  if (!ts.isAwaitExpression(node)) return false;
  const call = unwrap(node.expression);
  if (!ts.isCallExpression(call)) return false;
  const callee = call.expression;
  return (ts.isIdentifier(callee) && callee.text === name) || (ts.isPropertyAccessExpression(callee) && callee.name.text === name);
}

/** Every await (including `for await`) and every call not itself awaited (`void write()`, `.then`), in source order. */
function awaitsIn(node: ts.Node): ts.Node[] {
  const out: ts.Node[] = [];
  const visit = (n: ts.Node) => {
    let up = n.parent;
    while (ts.isParenthesizedExpression(up)) up = up.parent;
    const unawaitedCall = (ts.isCallExpression(n) || ts.isNewExpression(n)) && !ts.isAwaitExpression(up);
    if (ts.isAwaitExpression(n) || (ts.isForOfStatement(n) && n.awaitModifier) || unawaitedCall) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/**
 * The first node under a top-level statement that matches and is certain to run: it does not
 * look inside nested functions, the branches of an `if` or `?:`, the right side of && / || / ??,
 * the arguments of an optional call, or loops, try and switch blocks.
 */
function firstCertain(statement: ts.Statement, match: (n: ts.Node) => boolean): ts.Node | undefined {
  const certainKinds = [ts.isExpressionStatement, ts.isVariableStatement, ts.isIfStatement, ts.isReturnStatement];
  if (!certainKinds.some((is) => is(statement))) return undefined;
  const visit = (n: ts.Node): ts.Node | undefined => {
    if (match(n)) return n;
    if (ts.isFunctionLike(n) || ts.isClassLike(n)) return undefined;
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) return visit(n.left);
    if (ts.isConditionalExpression(n)) return visit(n.condition);
    if (ts.isIfStatement(n)) return visit(n.expression);
    if (ts.isCallExpression(n) && n.questionDotToken) return visit(n.expression);
    let found: ts.Node | undefined;
    ts.forEachChild(n, (child) => (found ??= visit(child)));
    return found;
  };
  return visit(statement);
}

/** Why `fn` does not start with `await guard(...)`, or null when it does. `first` are the awaits allowed before it. */
function guardProblem(fn: FunctionNode, guardName: string, first: string[]): string | null {
  if (!fn.body || !ts.isBlock(fn.body)) return "has no block body the scan can check";
  const statements = fn.body.statements;
  const index = statements.findIndex((s) => firstCertain(s, (n) => isAwaitOf(n, guardName)));
  if (index < 0) return `does not await ${guardName}( at the top level of its body (not in a closure, branch or && / ||)`;
  const guard = firstCertain(statements[index], (n) => isAwaitOf(n, guardName))!;

  // Anything awaited or called before, or inside, the guard call has already run by the time it answers.
  const early = awaitsIn(fn.body).filter((a) => a !== guard && a.getStart() < guard.getEnd());
  const certainBefore = (a: ts.Node) => statements.slice(0, index + 1).some((s) => firstCertain(s, (n) => n === a));
  const expected = early.length === first.length && early.every((a, i) => isAwaitOf(a, first[i]) && certainBefore(a));
  if (expected) return null;
  return first.length === 0 ? `awaits or calls something before ${guardName}(` : `awaits or calls something other than ${first.map((f) => `one top-level ${f}()`).join(", ")} before ${guardName}(`;
}

describe("server actions are guarded (spec 0.7 §4.7)", () => {
  const everything = sourceFiles();
  const files = everything.filter(({ file, source }) => file.startsWith("app/") && isUseServerFile(source));

  it("finds the action files, so the scan cannot pass by looking at nothing", () => {
    const names = files.map((f) => f.file);
    for (const expected of ["app/(app)/store/actions.ts", "app/(app)/products/status-actions.ts", "app/(app)/planograms/actions.ts", "app/(editor)/layout/edit/actions.ts", "app/create-store/actions.ts"]) {
      expect(names).toContain(expected);
    }
  });

  it("every exported action awaits requireSwitchForAction first (the allow-list is named, with its reason)", () => {
    const offenders = files.flatMap(({ file, source }) =>
      exportsOf(source).flatMap(({ name, fn, problem }) => {
        const { guard, first } = ALLOWED[file] ?? { guard: GUARD, first: [] };
        if (fn === null) return [`${file}: ${name} ${problem ?? "is not an async function the scan can check"}`];
        const why = guardProblem(fn, guard, first);
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
