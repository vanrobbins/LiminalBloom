import { describe, expect, it } from "vitest";

import { byName, compareNames, typeHint } from "./natural-sort";

describe("natural sort", () => {
  it("puts Rack 2 before Rack 10, ignoring case", () => {
    const names = byName([{ name: "Rack 10" }, { name: "rack 2" }, { name: "Rack 7" }, { name: "Front table 1" }]).map((n) => n.name);
    expect(names).toEqual(["Front table 1", "rack 2", "Rack 7", "Rack 10"]);
    expect(compareNames("Wall bay 3", "Wall bay 12")).toBeLessThan(0);
  });

  it("does not change the list it was given", () => {
    const list = [{ name: "B" }, { name: "A" }];
    byName(list);
    expect(list[0].name).toBe("B");
  });

  it("drops the type when the name already says it", () => {
    expect(typeHint("Rack 7", "Rack")).toBeUndefined();
    expect(typeHint("Front wall bay 2", "Wall bay")).toBeUndefined();
    expect(typeHint("Center run 1", "Frame rack")).toBe("Frame rack");
  });
});
