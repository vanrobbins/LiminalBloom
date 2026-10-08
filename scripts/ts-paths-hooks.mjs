import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const isFile = (url) => {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
};

export async function resolve(specifier, context, nextResolve) {
  const isRelative = /^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:") && !context.parentURL.includes("/node_modules/");
  const base = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT) : isRelative ? new URL(specifier, context.parentURL) : null;
  if (base && !/\.[cm]?[jt]s$|\.json$/.test(base.pathname)) {
    for (const suffix of [".ts", "/index.ts"]) {
      const candidate = new URL(base.href + suffix);
      if (isFile(candidate)) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(base && isFile(base) ? base.href : specifier, context);
}
