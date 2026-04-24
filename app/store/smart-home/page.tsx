import type { Metadata } from "next";
import { getProducts } from "@/lib/store/queries";
import { SmartHomeClient } from "@/components/store/SmartHomeClient";
import { getStoreMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const m = getStoreMetadata();
  return {
    ...m,
    title: "ClalHome — أجهزة منزلية ذكية | ClalMobile",
    description: "مكانس روبوت، قلايات، آلات قهوة وخلاطات — فلاتر حسب الماركة والسعر والضمان.",
  };
}

export default async function SmartHomeStorePage() {
  const products = await getProducts({ type: "appliance", limit: 500 });
  return <SmartHomeClient products={products} />;
}
