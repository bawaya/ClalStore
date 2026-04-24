import type { Metadata } from "next";
import { getProducts } from "@/lib/store/queries";
import { CategoryStorefront } from "@/components/store/CategoryStorefront";
import { COMPUTER_SUBKINDS } from "@/lib/constants";
import { getStoreMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const m = getStoreMetadata();
  return {
    ...m,
    title: "كمبيوتر / لابتوب / طابعات — Acer, HP, Lenovo | ClalMobile",
    description: "لابتوبات للألعاب والأعمال + طابعات HP — مع ضمان رسمي وتقسيط.",
  };
}

export default async function ComputersStorePage() {
  const products = await getProducts({ type: "computer", limit: 500 });
  return (
    <CategoryStorefront
      products={products}
      title="💻 كمبيوتر، لابتوب وطابعات"
      titleHe="💻 מחשבים, לפטופים ומדפסות"
      subtitle="Acer، HP، Lenovo — لابتوبات أعمال، ألعاب، 2-in-1، وطابعات HP."
      subtitleHe="Acer, HP, Lenovo — לפטופים עסקיים, גיימינג, 2-in-1, ומדפסות."
      subkindOptions={COMPUTER_SUBKINDS}
      subkindRowLabel="فئة الجهاز"
      showPriceFilter={true}
      showWarrantyFilter={true}
      emptyIcon="💻"
    />
  );
}
