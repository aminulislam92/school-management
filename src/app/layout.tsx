import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Hind_Siliguri } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";

// Hind Siliguri covers both Bangla and Latin letters.
const hindSiliguri = Hind_Siliguri({
  variable: "--font-sans",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "School Management System",
  description: "School management for Bangladeshi schools and colleges",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="bn"
      className={`${hindSiliguri.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Language comes from a cookie (runtime data), so the provider and
            every page render inside this Suspense boundary. */}
        <Suspense fallback={null}>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
