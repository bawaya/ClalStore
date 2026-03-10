import type { Metadata } from "next";
import { Tajawal, Heebo, David_Libre } from "next/font/google";
import "@/styles/globals.css";
import { CookieConsent } from "@/components/shared/CookieConsent";
import { PWAInstallPrompt } from "@/components/shared/PWAInstallPrompt";
import { Analytics } from "@/components/shared/Analytics";
import { Providers } from "@/components/shared/Providers";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
  variable: "--font-tajawal",
});

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-heebo",
});

const davidLibre = David_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-david-libre",
});

export const metadata: Metadata = {
  title: "ClalMobile — وكيل رسمي لـ HOT Mobile",
  description: "متجر إلكتروني لبيع أجهزة وإكسسوارات وباقات HOT Mobile. توصيل لكل إسرائيل.",
  keywords: ["HOT Mobile", "ClalMobile", "أجهزة", "إكسسوارات", "باقات"],
  manifest: "/manifest.json",
  themeColor: "#c41040",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ClalMobile",
  },
  openGraph: {
    title: "ClalMobile",
    description: "وكيل رسمي لـ HOT Mobile",
    url: "https://clalmobile.com",
    siteName: "ClalMobile",
    locale: "ar_IL",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning style={{ backgroundColor: '#09090b', colorScheme: 'dark' }} className={`${tajawal.variable} ${heebo.variable} ${davidLibre.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ClalMobile" />
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
