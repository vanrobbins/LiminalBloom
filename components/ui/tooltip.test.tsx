import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// A control named only by aria-label, outside Button (which names itself).
const LABELLED_CONTROL = /<(button|[A-Za-z]+\.(?:Close|Toggle|Trigger)|DropdownMenuTrigger)\b(?:(?!>)[\s\S])*?aria-label=/g;

// These show their name as text, or open their own explanation.
const NOT_ICON_ONLY = new Set([
  "components/planograms/grid-tile.tsx", // the tile shows the product's name
  "components/store-map/lower-tables.tsx", // "front", "back"… on the button; the label adds the words around it
  "components/ui/info-popover.tsx", // opens a popover with the term in it
]);

function sources() {
  return ["app", "components"].flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .map((file) => `${dir}/${file.replaceAll("\\", "/")}`)
      .filter((file) => file.endsWith(".tsx") && !file.includes(".test.") && !NOT_ICON_ONLY.has(file)),
  );
}

describe("icon-only controls (Week 6.5 spec §5.1)", () => {
  it("all sit inside a Tooltip or NameTip", () => {
    const offenders = sources().flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(LABELLED_CONTROL)]
        .filter((match) => !/<(Tooltip|NameTip)\b[^\n]*\s*$/.test(source.slice(0, match.index)))
        .map((match) => `${file}: ${match[1]}`);
    });
    expect(offenders).toEqual([]);
  });
});
