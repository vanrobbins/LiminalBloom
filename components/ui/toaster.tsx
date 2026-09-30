// Renders the toast store with Radix Toast: announced to screen readers,
// swipe to dismiss, paused while hovered or focused. Errors are announced
// straight away ("foreground"); confirmations politely ("background").
//
// Toasts float, so they get a shadow (§5.5).

"use client";

import { CircleAlert, CircleCheck, X, type LucideIcon } from "lucide-react";
import { Toast } from "radix-ui";

import { dismissToast, useToasts, type ToastTone } from "@/lib/toast";

const TONES: Record<ToastTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: "text-ok" },
  error: { icon: CircleAlert, className: "text-danger" },
};

export function Toaster() {
  const toasts = useToasts();

  return (
    <Toast.Provider swipeDirection="right" duration={6000}>
      {toasts.map((item) => {
        const { icon: Icon, className } = TONES[item.tone];

        return (
          <Toast.Root
            key={item.id}
            type={item.tone === "error" ? "foreground" : "background"}
            onOpenChange={(open) => {
              if (!open) {
                dismissToast(item.id);
              }
            }}
            className="flex items-start gap-3 rounded-lg border border-line-subtle bg-raised p-4 shadow-lg data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)"
          >
            <Icon
              aria-hidden="true"
              strokeWidth={1.75}
              className={`mt-0.5 size-5 shrink-0 ${className}`}
            />
            <div className="flex flex-1 flex-col gap-1">
              <Toast.Title className="font-medium text-ink">{item.title}</Toast.Title>
              {item.description ? (
                <Toast.Description className="text-sm text-ink-muted">
                  {item.description}
                </Toast.Description>
              ) : null}
            </div>
            <Toast.Close
              aria-label="Dismiss"
              className="-m-2 flex size-11 shrink-0 items-center justify-center text-ink-muted"
            >
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Toast.Close>
          </Toast.Root>
        );
      })}
      <Toast.Viewport className="fixed inset-x-0 bottom-0 z-60 mx-auto flex w-full max-w-sm flex-col gap-2 p-4 outline-none md:right-0 md:left-auto md:mx-0" />
    </Toast.Provider>
  );
}
