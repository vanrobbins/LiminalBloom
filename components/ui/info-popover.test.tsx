import { readdirSync, readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GLOSSARY } from "@/lib/glossary";

import { InfoPopover } from "./info-popover";

describe("InfoPopover", () => {
  it("opens the glossary text on a click and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<InfoPopover term="frameRack" />);
    const button = screen.getByRole("button", { name: "What's frame rack?" });
    await user.click(button);
    expect(screen.getByText(GLOSSARY.frameRack.text)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText(GLOSSARY.frameRack.text)).toBeNull();
    expect(button).toHaveFocus();
  });
});

describe("GLOSSARY", () => {
  it("keeps every entry short: at most 240 characters and two sentences", () => {
    for (const [key, { text }] of Object.entries(GLOSSARY)) {
      expect(text.length, key).toBeLessThanOrEqual(240);
      expect(text.split(/[.!?](\s|$)/).filter((s) => s.trim()).length, key).toBeLessThanOrEqual(2);
    }
  });

  it("has every term an InfoPopover names", () => {
    const files = ["app", "components"].flatMap((dir) =>
      readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx$/.test(f) && !f.includes(".test.")).map((f) => `${dir}/${f}`),
    );
    const used = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<InfoPopover term="(\w+)"/g)].map((m) => m[1]));
    for (const term of used) expect(Object.keys(GLOSSARY), term).toContain(term);
  });
});
