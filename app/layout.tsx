import "./globals.css";
import type { Viewport } from "next";
import { DM_Sans, DM_Mono, Orbitron } from "next/font/google";
import { WalletProviderWrapper } from "@/components/providers/wallet-provider-wrapper";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";
import { DOMErrorHandler } from "@/components/dom-error-handler";
import { GoogleTranslateBlocker } from "@/components/google-translate-blocker";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
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
