// Light and dark mode for the whole app (proposal §3.12).
//
// A client component because next-themes reads localStorage and the device
// setting, which only exist in the browser. It sets the .dark class on <html>
// from an inline script that runs before the page paints, so a reload never
// flashes the wrong theme.

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
