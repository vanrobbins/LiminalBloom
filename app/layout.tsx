import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/toaster";

// Allo (Josh Puckett, SIL OFL 1.1, license beside the file) is the app's typeface:
// the variable "Friendly" cut, every weight in one file, its optical size following
// the font size. Self-hosted, as every font here is: DM Mono is downloaded at build
// time and served from this app's own domain, so a browser never contacts Google.
// DM Mono is not variable, so it names its weights.
const allo = localFont({
  src: "./fonts/AlloVariableFriendly.woff2",
  variable: "--font-allo",
  weight: "100 900",
  display: "swap",
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
      className={`${allo.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
