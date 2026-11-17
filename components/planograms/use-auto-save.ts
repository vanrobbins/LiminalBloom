// The debounce behind a panel that saves as you type (0.7.0.5 spec §2.4): a
// text field's value waits SAVE_DELAY_MS after the last keystroke, a choice
// goes at once, a blur or the panel closing sends what is waiting. One wait is
// one send, which is one Undo step. The commit that runs is the one from the
// latest render, so a flush on unmount still saves into the thing it was for.

"use client";

import { useCallback, useEffect, useRef } from "react";

export const SAVE_DELAY_MS = 600;

const FLUSH_EVENT = "autosave:flush";

/**
 * Sends every edit still waiting, for something that must build on what is typed (Undo, a face move): the promise
 * settles once they have all come back, and is null when nothing was waiting, so the caller need not wait at all.
 */
export function flushPendingEdits(): Promise<unknown> | null {
  const sends: Promise<unknown>[] = [];
  document.dispatchEvent(new CustomEvent<Promise<unknown>[]>(FLUSH_EVENT, { detail: sends }));
  return sends.length ? Promise.all(sends) : null;
}

export function useAutoSave<V>(commit: (values: V) => void | Promise<void>, delay = SAVE_DELAY_MS) {
  const waiting = useRef<{ values: V } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(commit);
  useEffect(() => {
    run.current = commit;
  });

  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  /** What is waiting is stale (the numbers were replaced under it): drop it, send nothing. */
  const cancel = useCallback(() => {
    stop();
    waiting.current = null;
  }, [stop]);

  /** The numbers under what is waiting were replaced, and it was typed over only some of them: it waits on as `values`, on its own pause. */
  const rebase = useCallback((values: V) => {
    if (waiting.current) waiting.current = { values };
  }, []);

  function flush() {
    stop();
    const sending = waiting.current;
    waiting.current = null;
    return sending ? run.current(sending.values) : undefined;
  }

  // The unmount cleanup below must call the latest flush, which closes over nothing but refs.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => void flushRef.current(), []);
  useEffect(() => {
    function onFlush(event: Event) {
      const sending = flushRef.current();
      if (sending) (event as CustomEvent<Promise<unknown>[]>).detail.push(sending);
    }
    document.addEventListener(FLUSH_EVENT, onFlush);
    return () => document.removeEventListener(FLUSH_EVENT, onFlush);
  }, []);

  return {
    /** A text field changed: send after the pause. */
    later(values: V) {
      stop();
      waiting.current = { values };
      timer.current = setTimeout(flush, delay);
    },
    /** A select, stepper or toggle changed: send now. */
    now(values: V) {
      stop();
      waiting.current = null;
      void run.current(values);
    },
    flush,
    cancel,
    rebase,
  };
}
