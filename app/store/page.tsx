export const runtime = 'edge';

import type { Metadata } from "next";
import { getProducts, getHeroes, getLinePlans } from "@/lib/store/queries";
import { StoreClient } from "@/components/store/StoreClient";
import { getStoreMetadata } from "@/lib/seo";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getStoreMetadata();
}

export default async function StorePage() {
  const [products, heroes, linePlans] = await Promise.all([
    getProducts(),
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
