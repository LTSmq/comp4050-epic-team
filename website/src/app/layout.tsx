import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/components/settings/settingsProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thomax - Perfect Fit",
  description: "Smarter systems. Smoother operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT;
  return (
    <html 
      lang="en" 
      className={`${geistSans.variable} ${geistMono.variable}`} 
      suppressHydrationWarning
    >
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
        {commit && (
          <small className="build-commit" title={commit}>Commit {commit.slice(0, 7)}</small>
        )}
      </body>
    </html>
  );
}
