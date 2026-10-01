// The theme toggle on pages without the app shell: landing, sign-in, sign-up
// and create-store. Signed-in pages have it in the account menu instead.

import { ThemeToggle } from "@/components/ui/theme-toggle";

export function CornerThemeToggle() {
  return (
    <div className="fixed right-3 top-3 z-50">
      <ThemeToggle />
    </div>
  );
}
