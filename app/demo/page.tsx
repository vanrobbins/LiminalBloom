// /demo: the working prototype full screen, with made-up data held in this
// tab only. Lives on the feature/prototype-walkthrough branch, never merged.

import type { Metadata } from "next";
import Link from "next/link";

import { DemoApp } from "@/components/demo/demo-app";
import { DemoStoreProvider } from "@/components/demo/demo-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Liminal Bloom: try the demo",
  description: "A working demo of Liminal Bloom with a made-up store. Nothing is saved.",
};

export default function DemoPage() {
  return (
    <div className="flex h-dvh flex-col bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-1.5">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full bg-brand" />
          <span className="font-semibold text-ink">Liminal Bloom</span>
          <span className="hidden truncate text-ink-muted sm:inline">· Demo with made-up data</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Link href="/" className="inline-flex min-h-11 items-center px-2 text-sm text-brand-strong underline underline-offset-4">
            Walkthrough
          </Link>
          <ThemeToggle />
        </span>
      </div>
      <DemoStoreProvider>
        <DemoApp start={{ name: "home" }} />
      </DemoStoreProvider>
    </div>
  );
}
