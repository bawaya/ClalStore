import type { Metadata } from "next";
import { getProducts } from "@/lib/store/queries";
import { CategoryStorefront } from "@/components/store/CategoryStorefront";
import { NETWORK_SUBKINDS } from "@/lib/constants";
import { getStoreMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const m = getStoreMetadata();
  return {
    ...m,
    title: "راوتر و شبكة — TP-Link Mesh | ClalMobile",
    description: "أنظمة Mesh، موسّعات شبكة WiFi 6/7 من TP-Link.",
  };
}

export default async function NetworkStorePage() {
  const products = await getProducts({ type: "network", limit: 500 });
  return (
    <CategoryStorefront
      products={products}
      title="📡 راوتر وشبكة (TP-Link و غيرها)"
      titleHe="📡 ראוטרים ורשת"
      subtitle="أنظمة Mesh وموسّعات شبكة لتغطية كاملة بأحدث معايير WiFi."
      subtitleHe="מערכות Mesh ומגדילי טווח לכיסוי מלא."
      subkindOptions={NETWORK_SUBKINDS}
      subkindRowLabel="فئة الجهاز"
      showPriceFilter={true}
      emptyIcon="📡"
    />
  );
}
