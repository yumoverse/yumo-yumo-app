import "./globals.css";
import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Mono, Orbitron } from "next/font/google";
import { WalletProviderWrapper } from "@/components/providers/wallet-provider-wrapper";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";
import { DOMErrorHandler } from "@/components/dom-error-handler";
import { GoogleTranslateBlocker } from "@/components/google-translate-blocker";
import { PwaInit } from "@/components/pwa/pwa-init";

export const metadata: Metadata = {
  applicationName: "Yumo Yumo",
  title: {
    default: "Yumo Yumo",
    template: "%s | Yumo Yumo",
  },
  description: "Upload receipts, track rewards, and use Yumo Yumo like an installable mobile app.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yumo Yumo",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/pwa/apple-touch-icon.png",
    icon: [
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/pwa/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0F1117",
  colorScheme: "dark",
};

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-orbitron",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${dmSans.variable} ${dmMono.variable} ${orbitron.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning className={dmSans.className}>
        <PwaInit />
        <GoogleTranslateBlocker />
        <DOMErrorHandler />
        <WalletProviderWrapper>
          <ErrorBoundary>
            {children}
            <Toaster />
          </ErrorBoundary>
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
