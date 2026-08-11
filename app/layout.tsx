import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import { TopNav } from "@/components/TopNav";
import { CacheWarmer } from "@/components/CacheWarmer";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "UMMED Analytics",
  description: "Ombor va savdo boshqaruv paneli — MoySklad asosida",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className={`${inter.variable} font-sans antialiased`}>
        <LanguageProvider>
          <CacheWarmer />
          <div className="min-h-screen bg-surface pb-16">
            <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 lg:px-8">
              <TopNav />
              <main className="mt-6">{children}</main>
            </div>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
