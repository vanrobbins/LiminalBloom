// Short on-screen notices (§3.12.3): what happened, and what to do next.
//
// A plain module-level store, read through useSyncExternalStore, so any
// client component can call toast() without a provider or context. The
// Toaster in the root layout renders whatever is here.

import { useSyncExternalStore } from "react";

export type ToastTone = "success" | "error";

export type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

/** More than this at once is noise; the oldest make way. */
export const MAX_TOASTS = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function toast(input: Omit<Toast, "id">): number {
  const id = nextId++;
  toasts = [...toasts, { ...input, id }].slice(-MAX_TOASTS);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The server never has toasts; a stable empty array avoids a re-render loop.
const NO_TOASTS: Toast[] = [];

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribeToToasts, getToasts, () => NO_TOASTS);
}
