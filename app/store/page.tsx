
import type { Metadata } from "next";
import { getProducts, getLinePlans, getStoreSpotlights } from "@/lib/store/queries";
import { StoreClient } from "@/components/store/StoreClient";
import { getStoreMetadata } from "@/lib/seo";

// Always render dynamically — build-time DB unreachable would cache empty/fallback HTML for 30 days.
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return getStoreMetadata();
}

// Note: HeroCarousel removed from /store. The new editorial Spotlight section
// (1 big + 3 small) is fed by getStoreSpotlights() and managed from
// /admin/store-spotlights.
export default async function StorePage() {
  const [products, linePlans, spotlights] = await Promise.all([
    getProducts({ limit: 500, types: ["device", "accessory"] }),
    // Note: appliance / tv / computer / tablet / network have their own dedicated storefronts.
    getLinePlans(),
    getStoreSpotlights(),
  ]);

  return (
    <StoreClient
      products={products}
      linePlans={linePlans}
      spotlights={spotlights}
    />
  );
}
