import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import AlertProvider from "@/components/AlertProvider";
import AppShell from "@/components/AppShell";
import SWRegister from "@/components/SWRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Arshadrobe — Your AI Wardrobe",
    template: "%s · Arshadrobe",
  },
  description:
    "Your closet, styled by AI. Catalog your wardrobe, get outfit ideas for any occasion, and see yourself wearing them.",
  applicationName: "Arshadrobe",
  appleWebApp: {
    capable: true,
    title: "Arshadrobe",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf6f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AlertProvider>
          <AppShell>{children}</AppShell>
        </AlertProvider>
        <SWRegister />
      </body>
    </html>
  );
}
