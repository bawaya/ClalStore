// =====================================================
// ClalMobile — Mobile PWA Layout (lightweight)
// =====================================================

import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Providers } from "@/components/shared/Providers";
import { MobilePushInit } from "@/components/mobile/MobilePushInit";
import { getCachedPublicSettings } from "@/lib/settings/public-cached";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedPublicSettings().catch(() => ({} as Record<string, string>));
  const logoUrl = settings.logo_url?.trim();
  const storeName = settings.store_name?.trim() || "ClalMobile";

  const icons = logoUrl
    ? { icon: logoUrl, apple: logoUrl }
    : {
        icon: "/icons/favicon.svg",
        apple: "/icons/apple-touch-icon.svg",
      };

  return {
    title: `${storeName} — صندوق الوارد`,
    description: "إدارة محادثات واتساب — ClalMobile",
    manifest: "/m-manifest.json",
    icons,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "الوارد",
    },
  };
}

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
