export const runtime = 'edge';

// =====================================================
// ClalMobile — Homepage (Landing Page)
// Server Component: fetches products + plans from DB
// =====================================================

import { getProducts, getLinePlans, getWebsiteContent } from "@/lib/store/queries";
import { HomeClient } from "@/components/website/HomeClient";
import type { WebsiteContent } from "@/types/database";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "ClalMobile — وكيل رسمي لـ HOT Mobile | أجهزة وباقات",
  description: "أحدث الأجهزة الذكية من Samsung و Apple و Xiaomi مع باقات HOT Mobile. توصيل مجاني لكل أنحاء إسرائيل.",
  openGraph: {
    title: "ClalMobile — وكيل رسمي لـ HOT Mobile",
    description: "أجهزة ذكية، باقات مميزة، توصيل مجاني.",
    url: "https://clalmobile.com",
    siteName: "ClalMobile",
    locale: "ar_IL",
    type: "website",
  },
};

export default async function HomePage() {
  let products: any[] = [];
  let plans: any[] = [];
  let cms: Record<string, WebsiteContent> = {};

  try {
    [products, plans, cms] = await Promise.all([
      getProducts({ featured: true }),
      getLinePlans(),
      getWebsiteContent(),
    ]);
  } catch {}

  return <HomeClient products={products} plans={plans} cms={cms} />;
}
