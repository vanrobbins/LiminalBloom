// The demo's toast: what just happened, with Undo when it can be undone. It
// sits above the bottom tabs and is announced politely.

"use client";

import { useNav } from "./demo-nav";
import { FOCUS } from "./looks";

export function DemoToast() {
  const { toast, say } = useNav();

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-16 z-30 flex justify-center @3xl:bottom-4">
      {toast ? (
        <p
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm shadow-lg ${toast.tone === "refused" ? "border border-danger bg-danger-tint text-danger" : "bg-ink text-surface"}`}
        >
          <span>{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                say("Undone");
              }}
              className={`min-h-11 shrink-0 px-2 font-semibold underline underline-offset-4 ${FOCUS}`}
            >
              {toast.action.label}
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
