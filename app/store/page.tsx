export const runtime = 'edge';

import { getProducts, getHeroes, getLinePlans } from "@/lib/store/queries";
import { StoreClient } from "@/components/store/StoreClient";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "ClalMobile — المتجر",
  description: "أجهزة وإكسسوارات وباقات HOT Mobile. توصيل لكل إسرائيل.",
};

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
