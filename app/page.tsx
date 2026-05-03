
// =====================================================
// ClalMobile — Homepage (Landing Page)
// Server Component: fetches products + plans from DB
// =====================================================

import { getProducts, getLinePlans, getWebsiteContent } from "@/lib/store/queries";
import { HomeClient } from "@/components/website/HomeClient";
import type { WebsiteContent } from "@/types/database";

// Always render dynamically — prevents serving build-time stale fallback data when DB is unreachable at build.
export const dynamic = "force-dynamic";
export const revalidate = 60;

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
  // Use Promise.allSettled so a single failing fetch doesn't blank out the homepage,
  // and so each failure is logged independently for observability.
  const results = await Promise.allSettled([
    getProducts({ featured: true, types: ["device", "accessory"] }),
    getLinePlans(),
    getWebsiteContent(),
  ]);

  const [productsResult, plansResult, cmsResult] = results;

  const products = productsResult.status === "fulfilled" ? productsResult.value : [];
  const plans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const cms: Record<string, WebsiteContent> =
    cmsResult.status === "fulfilled" ? cmsResult.value : {};

  if (productsResult.status === "rejected") {
    console.error("[home page] getProducts failed:", productsResult.reason);
  }
  if (plansResult.status === "rejected") {
    console.error("[home page] getLinePlans failed:", plansResult.reason);
  }
  if (cmsResult.status === "rejected") {
    console.error("[home page] getWebsiteContent failed:", cmsResult.reason);
  }

  return <HomeClient products={products} plans={plans} cms={cms} />;
}
