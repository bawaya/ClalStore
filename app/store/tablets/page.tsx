import type { Metadata } from "next";
import { getProducts } from "@/lib/store/queries";
import { CategoryStorefront } from "@/components/store/CategoryStorefront";
import { TABLET_SUBKINDS } from "@/lib/constants";
import { getStoreMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const m = getStoreMetadata();
  return {
    ...m,
    title: "تابلت — iPad / FunPad / أندرويد | ClalMobile",
    description: "iPad Pro / Air / Mini وتابلت أطفال — كل الأحجام بضمان رسمي وتقسيط.",
  };
}

export default async function TabletsStorePage() {
  const products = await getProducts({ type: "tablet", limit: 500 });
  return (
    <CategoryStorefront
      products={products}
      title="📱 تابلت (iPad / FunPad / أندرويد)"
      titleHe="📱 טאבלטים"
      subtitle="iPad Pro، Air، Mini وتابلت أطفال — اختر الحجم والتخزين والتشكيل."
      subtitleHe="iPad Pro, Air, Mini וטאבלטים לילדים."
      subkindOptions={TABLET_SUBKINDS}
      subkindRowLabel="فئة التابلت"
      showPriceFilter={true}
      emptyIcon="📱"
    />
  );
}
