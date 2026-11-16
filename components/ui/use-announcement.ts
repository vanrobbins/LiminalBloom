// The text for a polite live region. The same words said twice must still change the text,
// or a screen reader stays silent the second time: a zero-width space is toggled on the end.

"use client";

import { useCallback, useState } from "react";

export function useAnnouncement() {
  const [text, setText] = useState("");
  const say = useCallback((next: string) => setText((current) => (current === next ? `${next}\u200B` : next)), []);
  return [text, say] as const;
}
