import type { Metadata } from "next";
import { getProducts } from "@/lib/store/queries";
import { CategoryStorefront } from "@/components/store/CategoryStorefront";
import { TV_SUBKINDS } from "@/lib/constants";
import { getStoreMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const m = getStoreMetadata();
  return {
    ...m,
    title: "تلفزيونات 4K — LG / Samsung / Hisense | ClalMobile",
    description: "تلفزيونات OLED, QLED, NEO QLED بأسعار منافسة وضمان رسمي.",
  };
}

export default async function TvsStorePage() {
  const products = await getProducts({ type: "tv", limit: 500 });
  return (
    <CategoryStorefront
      products={products}
      title="📺 تلفزيونات (LG / Samsung / Hisense)"
      titleHe="📺 טלוויזיות"
      subtitle="OLED، QLED، NEO QLED، Mini LED — كل التقنيات والأحجام بأسعار منافسة."
      subtitleHe="OLED, QLED, NEO QLED, Mini LED — בכל הטכנולוגיות והגדלים."
      subkindOptions={TV_SUBKINDS}
      subkindRowLabel="تقنية الشاشة"
      showScreenSizeFilter={true}
      showPriceFilter={true}
      emptyIcon="📺"
    />
  );
}
