// The second half of the guard scan (server-actions-guard.test.ts): every awaited switch guard in
// an action must be branched on, not only the first. "Branched on" means the comparison with
// "forbidden" is the whole condition of an `if` or a ternary (through parentheses, `!` and `||`,
// where any true side still refuses, plus `x && (await guard()).status === "forbidden"`, where `x`
// only decides whether the guard runs), an `if`'s refusing branch returns or throws, and a ternary
// is itself returned or thrown: a
// stray comparison (assigned, logged, returned), or one a second condition can outvote, would let
// a forbidden request carry on.
//
// The result must be checked inline: `if (guard.status === "forbidden") return ...` or the same in
// a ternary. Keeping the comparison in a variable (`const gone = c.status === "forbidden"`) or a
// `switch` on `.status` is correct code that this scan flags on purpose: it cannot follow the
// value, and one way to write the check keeps the scan honest.

import ts from "typescript";

import { isAwaitOf, type FunctionNode } from "./server-actions-scan";

const EQUALITY = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];

const unparen = (n: ts.Node): ts.Node => (ts.isParenthesizedExpression(n) ? unparen(n.expression) : n);

/** The nearest ancestor that is not a pair of parentheses. */
function outer(n: ts.Node): ts.Node {
  let up = n.parent;
  while (ts.isParenthesizedExpression(up)) up = up.parent;
  return up;
}

/** The comparison of `node` with the text "forbidden" (=== !== == !=, either side), or null. */
function comparisonWithForbidden(node: ts.Node): ts.BinaryExpression | null {
  const up = outer(node);
  if (!ts.isBinaryExpression(up) || !EQUALITY.includes(up.operatorToken.kind)) return null;
  const other = unparen(unparen(up.left) === node ? up.right : up.left);
  return ts.isStringLiteral(other) && other.text === "forbidden" ? up : null;
}

/** Whether a branch leaves the function: a return or throw, alone or at the top level of a block. */
const leaves = (s: ts.Statement | undefined): boolean => !!s && (ts.isReturnStatement(s) || ts.isThrowStatement(s) || (ts.isBlock(s) && s.statements.some(leaves)));

/**
 * Whether `comparison` alone decides a branch, and the branch a forbidden answer takes leaves the
 * function. `inline` says the guard is awaited inside the comparison, so an `x &&` before it only
 * decides whether the guard runs at all; with a variable, `&&` would let a forbidden request through.
 */
function decidesABranch(comparison: ts.BinaryExpression, inline: boolean): boolean {
  let refusesWhenTrue = comparison.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken || comparison.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken;
  let node: ts.Node = comparison;
  for (;;) {
    const up = node.parent;
    if (ts.isParenthesizedExpression(up)) {
      node = up;
    } else if (ts.isPrefixUnaryExpression(up) && up.operator === ts.SyntaxKind.ExclamationToken) {
      refusesWhenTrue = !refusesWhenTrue;
      node = up;
    } else if (ts.isBinaryExpression(up) && refusesWhenTrue && (up.operatorToken.kind === ts.SyntaxKind.BarBarToken || (inline && up.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && up.right === node))) {
      node = up;
    } else if (ts.isIfStatement(up) && up.expression === node) {
      return leaves(refusesWhenTrue ? up.thenStatement : up.elseStatement);
    } else {
      // A ternary leaves only when it is what the function returns or throws; one kept in a
      // variable lets a forbidden request carry on to the next line.
      if (!ts.isConditionalExpression(up) || up.condition !== node) return false;
      const holder = outer(up);
      return ts.isReturnStatement(holder) || ts.isThrowStatement(holder);
    }
  }
}

/** Whether the status read `node` is compared with "forbidden" as the deciding condition of a branch. */
function branchesOnForbidden(node: ts.Node, inline: boolean) {
  const comparison = comparisonWithForbidden(node);
  return comparison !== null && decidesABranch(comparison, inline);
}

const isStatusRead = (n: ts.Node): n is ts.PropertyAccessExpression => ts.isPropertyAccessExpression(n) && n.name.text === "status";

/** Whether `name.status` is compared with "forbidden" in an `if` or ternary condition, in code after `after` (the end of the guard's declaration). */
function statusOfIsChecked(body: ts.Node, name: string, after: number): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (n.pos >= after && isStatusRead(n) && ts.isIdentifier(n.expression) && n.expression.text === name && branchesOnForbidden(n, false)) found = true;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(body);
  return found;
}

/**
 * Why an action does not branch on its guard's answer, or null when every `await guard(...)` in it
 * has its `.status` compared with "forbidden" as the condition of an `if` or ternary, inline or through the
 * variable it was assigned to (after it was assigned).
 * Awaiting the guard first is not enough: a second guard (the switch depends on the data) whose
 * answer is ignored lets a forbidden request carry on, and the types only force the check when
 * `.member` is read.
 */
export function forbiddenProblem(fn: FunctionNode, guardName: string): string | null {
  const problems: string[] = [];
  const visit = (n: ts.Node) => {
    if (isAwaitOf(n, guardName)) {
      const up = outer(n);
      if (isStatusRead(up) && unparen(up.expression) === n) {
        if (!branchesOnForbidden(up, true)) problems.push(`reads await ${guardName}(...).status but never branches on it being "forbidden"`);
      } else if (ts.isVariableDeclaration(up) && ts.isIdentifier(up.name)) {
        if (!statusOfIsChecked(fn.body!, up.name.text, up.end)) problems.push(`never checks ${up.name.text}.status === "forbidden" in an if or ternary after awaiting ${guardName}(`);
      } else {
        problems.push(`awaits ${guardName}( without checking its status: keep the answer in a variable and compare .status with "forbidden"`);
      }
    }
    ts.forEachChild(n, visit);
  };
  if (fn.body) visit(fn.body);
  return problems.length ? problems.join("; ") : null;
}
