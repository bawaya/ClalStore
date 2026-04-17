// =====================================================
// ClalMobile — Mobile PWA Layout (lightweight)
// =====================================================

import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Providers } from "@/components/shared/Providers";
import { MobilePushInit } from "@/components/mobile/MobilePushInit";

export const metadata: Metadata = {
  title: "ClalMobile — صندوق الوارد",
  description: "إدارة محادثات واتساب — ClalMobile",
  manifest: "/m-manifest.json",
  icons: {
    icon: "/icons/favicon.svg",
    apple: "/icons/apple-touch-icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "الوارد",
  },
};

export const viewport: Viewport = {
  themeColor: "#111114",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      lang="ar"
      className="font-arabic bg-surface-bg text-white min-h-[100dvh] max-h-[100dvh] overflow-hidden"
    >
      <Providers>
        <MobilePushInit />
        {children}
      </Providers>
    </div>
  );
}
