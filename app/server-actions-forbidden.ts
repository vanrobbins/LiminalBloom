// The second half of the guard scan (server-actions-guard.test.ts): every awaited switch guard in
// an action must be branched on, not only the first. "Branched on" means the comparison with
// "forbidden" decides an `if` or a ternary, after the guard was awaited: a stray comparison
// (assigned, logged, returned) would let a forbidden request carry on.

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

/** Whether `node` is compared with the text "forbidden" (=== !== == !=), on either side. */
function comparedToForbidden(node: ts.Node): boolean {
  const up = outer(node);
  if (!ts.isBinaryExpression(up) || !EQUALITY.includes(up.operatorToken.kind)) return false;
  const other = unparen(unparen(up.left) === node ? up.right : up.left);
  return ts.isStringLiteral(other) && other.text === "forbidden";
}

const LOGICAL = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken];

/** Whether `comparison` is (part of) the condition of an `if` or a ternary, through parentheses, `!`, `&&` and `||`. */
function decidesABranch(comparison: ts.Node): boolean {
  let node = comparison;
  for (;;) {
    const up = node.parent;
    const passesThrough = ts.isParenthesizedExpression(up) || (ts.isPrefixUnaryExpression(up) && up.operator === ts.SyntaxKind.ExclamationToken) || (ts.isBinaryExpression(up) && LOGICAL.includes(up.operatorToken.kind));
    if (!passesThrough) return (ts.isIfStatement(up) && up.expression === node) || (ts.isConditionalExpression(up) && up.condition === node);
    node = up;
  }
}

/** Whether the status read `node` is compared with "forbidden" in a branch condition. */
const branchesOnForbidden = (node: ts.Node) => comparedToForbidden(node) && decidesABranch(outer(node));

const isStatusRead = (n: ts.Node): n is ts.PropertyAccessExpression => ts.isPropertyAccessExpression(n) && n.name.text === "status";

/** Whether `name.status` is compared with "forbidden" in an `if` or ternary condition, in code after `after` (the end of the guard's declaration). */
function statusOfIsChecked(body: ts.Node, name: string, after: number): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (n.pos >= after && isStatusRead(n) && ts.isIdentifier(n.expression) && n.expression.text === name && branchesOnForbidden(n)) found = true;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(body);
  return found;
}

/**
 * Why an action does not branch on its guard's answer, or null when every `await guard(...)` in it
 * has its `.status` compared with "forbidden" in an `if` or ternary condition, inline or through the
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
        if (!branchesOnForbidden(up)) problems.push(`reads await ${guardName}(...).status but never branches on it being "forbidden"`);
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
