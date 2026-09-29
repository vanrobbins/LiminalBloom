import type { Metadata } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Downloaded at build time and served from this app's own domain, so a
// visitor's browser never contacts Google. DM Sans is a variable font and
// ships every weight in one file; DM Mono is not, so it names its weights.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Liminal Bloom",
  description:
    "A mobile-first visual merchandising platform for retail store teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes changes <html>'s class before
    // React loads, which React would otherwise report. It applies to this
    // element only, not its children.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {/* Temporary home until the app shell's user menu (Week 2, piece 3). */}
          <div className="fixed right-3 top-3 z-50">
            <ThemeToggle />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
