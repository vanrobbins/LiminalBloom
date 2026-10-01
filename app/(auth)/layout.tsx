// Sign-in and sign-up: no app shell, so the theme toggle sits in the corner.

import { CornerThemeToggle } from "@/components/corner-theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CornerThemeToggle />
      {children}
    </>
  );
}
