import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/store/queries";
import { ProductDetailClient } from "@/components/store/ProductDetail";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const product = await getProduct(params.id);
  if (!product) return { title: "منتج غير موجود" };
  return {
    title: `${product.name_ar} — ClalMobile`,
    description: product.description_ar || `${product.brand} ${product.name_ar} — ₪${product.price}`,
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.id);
  if (!product) notFound();

  // Related products (same brand or type)
  const related = await getProducts({ type: product.type as any, limit: 4 });
  const filtered = related.filter((p) => p.id !== product.id).slice(0, 3);

  return <ProductDetailClient product={product} related={filtered} />;
}
