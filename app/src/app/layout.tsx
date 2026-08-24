import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { THEME_INIT_SCRIPT } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Halal (HLC) — CPI-Indexed Stablecoin DAO",
  description:
    "Dashboard, governance, PSM swaps, and vesting for the Halal protocol — a CPI-indexed stablecoin governed by an on-chain DAO.",
  keywords: ["Halal", "HLC", "stablecoin", "CPI", "DAO", "Ethereum", "Arbitrum"],
  openGraph: {
    title: "Halal (HLC) — CPI-Indexed Stablecoin DAO",
    description: "Explore Halal’s CPI-indexed stablecoin protocol, PSM, vesting, and on-chain governance.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Halal (HLC) — CPI-Indexed Stablecoin DAO",
    description: "Explore Halal’s CPI-indexed stablecoin protocol, PSM, vesting, and on-chain governance.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
