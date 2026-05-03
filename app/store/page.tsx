
import type { Metadata } from "next";
import { getProducts, getLinePlans } from "@/lib/store/queries";
import { StoreClient } from "@/components/store/StoreClient";
import { getStoreMetadata } from "@/lib/seo";

// Always render dynamically — build-time DB unreachable would cache empty/fallback HTML for 30 days.
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return getStoreMetadata();
}

// Note: HeroCarousel removed from /store on user request — banners are still
// editable from /admin/heroes for use elsewhere if needed.
export default async function StorePage() {
  const [products, linePlans] = await Promise.all([
    getProducts({ limit: 500, types: ["device", "accessory"] }),
    // Note: appliance / tv / computer / tablet / network have their own dedicated storefronts.
    getLinePlans(),
  ]);

  return <StoreClient products={products} linePlans={linePlans} />;
}
