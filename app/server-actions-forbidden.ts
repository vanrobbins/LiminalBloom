// The second half of the guard scan (server-actions-guard.test.ts): every awaited switch guard in
// an action must be branched on, not only the first.

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

const isStatusRead = (n: ts.Node): n is ts.PropertyAccessExpression => ts.isPropertyAccessExpression(n) && n.name.text === "status";

/** Whether `name.status` is compared with "forbidden" anywhere under `body`. */
function statusOfIsChecked(body: ts.Node, name: string): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (isStatusRead(n) && ts.isIdentifier(n.expression) && n.expression.text === name && comparedToForbidden(n)) found = true;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(body);
  return found;
}

/**
 * Why an action does not branch on its guard's answer, or null when every `await guard(...)` in it
 * has its `.status` compared with "forbidden", inline or through the variable it was assigned to.
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
        if (!comparedToForbidden(up)) problems.push(`reads await ${guardName}(...).status but never compares it with "forbidden"`);
      } else if (ts.isVariableDeclaration(up) && ts.isIdentifier(up.name)) {
        if (!statusOfIsChecked(fn.body!, up.name.text)) problems.push(`never checks ${up.name.text}.status === "forbidden" after awaiting ${guardName}(`);
      } else {
        problems.push(`awaits ${guardName}( without checking its status: keep the answer in a variable and compare .status with "forbidden"`);
      }
    }
    ts.forEachChild(n, visit);
  };
  if (fn.body) visit(fn.body);
  return problems.length ? problems.join("; ") : null;
}
