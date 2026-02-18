import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "ClalMobile — وكيل رسمي لـ HOT Mobile",
  description: "متجر إلكتروني لبيع أجهزة وإكسسوارات وباقات HOT Mobile. توصيل لكل إسرائيل.",
  keywords: ["HOT Mobile", "ClalMobile", "أجهزة", "إكسسوارات", "باقات"],
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
    <html lang="ar" dir="rtl" suppressHydrationWarning style={{ backgroundColor: '#09090b', colorScheme: 'dark' }}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap"
          rel="stylesheet"
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
        {children}
      </body>
    </html>
  );
}
