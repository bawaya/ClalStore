import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { fontVariables } from "@/app/fonts";
import { CookieConsent } from "@/components/shared/CookieConsent";
import { PWAInstallPrompt } from "@/components/shared/PWAInstallPrompt";
import { Analytics } from "@/components/shared/Analytics";
import { Providers } from "@/components/shared/Providers";
import { getCachedPublicSettings } from "@/lib/settings/public-cached";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedPublicSettings().catch(() => ({} as Record<string, string>));
  const logoUrl = settings.logo_url?.trim();
  const storeName = settings.store_name?.trim() || "ClalMobile";

  const icons = logoUrl
    ? { icon: logoUrl, apple: logoUrl, shortcut: logoUrl }
    : {
        icon: "/icons/favicon.svg",
        apple: "/icons/apple-touch-icon.svg",
        shortcut: "/icons/favicon.svg",
      };

  return {
    title: `${storeName} — وكيل رسمي لـ HOT Mobile`,
    description: "متجر إلكتروني لبيع أجهزة وإكسسوارات وباقات HOT Mobile. توصيل لكل إسرائيل.",
    keywords: ["HOT Mobile", "ClalMobile", "أجهزة", "إكسسوارات", "باقات"],
    manifest: "/manifest.json",
    icons,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: storeName,
    },
    openGraph: {
      title: storeName,
      description: "وكيل رسمي لـ HOT Mobile",
      url: "https://clalmobile.com",
      siteName: storeName,
      locale: "ar_IL",
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#c41040",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publicRuntimeEnv = JSON.stringify({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  }).replace(/</g, "\\u003c");

  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={fontVariables}
      style={{ backgroundColor: "#09090b", colorScheme: "dark" }}
    >
      <head>
        <script
          id="clal-public-env"
          dangerouslySetInnerHTML={{
            __html: `window.__CLAL_PUBLIC_ENV__ = ${publicRuntimeEnv};`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Store",
              name: "ClalMobile",
              url: "https://clalmobile.com",
              description: "وكيل رسمي لـ HOT Mobile — أجهزة ذكية وباقات",
              address: { "@type": "PostalAddress", addressCountry: "IL" },
              openingHoursSpecification: [
                { "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday","Monday","Tuesday","Wednesday","Thursday"], opens: "09:00", closes: "18:00" },
              ],
              priceRange: "₪₪",
              currenciesAccepted: "ILS",
              paymentAccepted: "Credit Card, Bank Transfer",
            }),
          }}
        />
      </head>
      <body className="font-arabic bg-surface-bg text-white min-h-screen antialiased" style={{ backgroundColor: '#09090b', color: '#fafafa' }}>
        <Providers>
          {children}
          <CookieConsent />
          <PWAInstallPrompt />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
