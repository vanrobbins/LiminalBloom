// The chapter in the URL hash, read without effects: the hash is an external
// store the browser already keeps, and each chapter gets a shareable link.

"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useChapterHash() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    // The server has no hash; the first chapter renders until the browser takes over.
    () => "",
  );
}
