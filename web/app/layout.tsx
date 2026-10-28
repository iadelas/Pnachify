import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pnachify — PS2 cheat codes to PNACH",
  description:
    "Turn PS2 cheat codes into a PNACH file in your phone browser. No install, no upload, works offline after the first load.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh text-neutral-100 antialiased">
        {children}
        <footer className="mx-auto max-w-2xl px-4 pb-10 pt-6 text-xs leading-relaxed text-neutral-500">
          <p>
            Built on{" "}
            <a
              className="underline hover:text-neutral-300"
              href="https://github.com/SkillerCMP/OmniConvertCS"
            >
              OmniConvertCS
            </a>{" "}
            by SkillerCMP, a rewrite of Pyriel&apos;s OmniConvert. GPL v2.
          </p>
          <p className="mt-1">
            Conversion runs in your browser. Your codes are never uploaded.
          </p>
        </footer>
      </body>
    </html>
  );
}
