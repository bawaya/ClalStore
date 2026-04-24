
import type { Metadata } from "next";
import { getProducts, getHeroes, getLinePlans } from "@/lib/store/queries";
import { StoreClient } from "@/components/store/StoreClient";
import { getStoreMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return getStoreMetadata();
}

export default async function StorePage() {
  const [products, heroes, linePlans] = await Promise.all([
    getProducts({ limit: 500, types: ["device", "accessory"] }),
    // Note: appliance / tv / computer / tablet / network have their own dedicated storefronts.
    getHeroes(),
    getLinePlans(),
  ]);

  return (
    <StoreClient
      products={products}
      heroes={heroes}
      linePlans={linePlans}
    />
  );
}
