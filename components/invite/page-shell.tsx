// The frame of the pages a person sees before they have a store (the invitation
// page and /welcome): centred card, no app shell, the theme toggle in the corner.
// create-store looks the same.

import { CornerThemeToggle } from "@/components/corner-theme-toggle";
import { Card } from "@/components/ui/card";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-16">
      <CornerThemeToggle />
      <Card className="flex w-full max-w-sm flex-col gap-4">{children}</Card>
    </main>
  );
}
