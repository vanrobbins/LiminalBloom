// The debounce behind a panel that saves as you type (0.7.0.5 spec §2.4): a
// text field's value waits SAVE_DELAY_MS after the last keystroke, a choice
// goes at once, a blur or the panel closing sends what is waiting. One wait is
// one send, which is one Undo step. The commit that runs is the one from the
// latest render, so a flush on unmount still saves into the thing it was for.

"use client";

import { useEffect, useRef } from "react";

export const SAVE_DELAY_MS = 600;

export function useAutoSave<V>(commit: (values: V) => void, delay = SAVE_DELAY_MS) {
  const waiting = useRef<{ values: V } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(commit);
  useEffect(() => {
    run.current = commit;
  });

  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  function flush() {
    cancel();
    const sending = waiting.current;
    waiting.current = null;
    if (sending) run.current(sending.values);
  }

  // The unmount cleanup below must call the latest flush, which closes over nothing but refs.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  return {
    /** A text field changed: send after the pause. */
    later(values: V) {
      cancel();
      waiting.current = { values };
      timer.current = setTimeout(flush, delay);
    },
    /** A select, stepper or toggle changed: send now. */
    now(values: V) {
      cancel();
      waiting.current = null;
      run.current(values);
    },
    flush,
  };
}
