import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAnnouncement } from "./use-announcement";

describe("useAnnouncement", () => {
  it("changes the text even when the same words are said again, so a live region speaks twice", () => {
    const { result } = renderHook(() => useAnnouncement());
    expect(result.current[0]).toBe("");
    act(() => result.current[1]("Link copied"));
    const first = result.current[0];
    act(() => result.current[1]("Link copied"));
    const second = result.current[0];
    expect(first).toBe("Link copied");
    expect(second).not.toBe(first);
    expect(second.replace("\u200B", "")).toBe("Link copied");
    act(() => result.current[1]("Link copied"));
    expect(result.current[0]).toBe("Link copied");
  });
});
