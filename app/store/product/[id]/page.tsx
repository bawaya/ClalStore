
import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/store/queries";
import { ProductDetailClient } from "@/components/store/ProductDetail";
import { getProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "منتج غير موجود" };
  return getProductMetadata(product);
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  // Related products (same brand or type)
  const related = await getProducts({ type: product.type as any, limit: 4 });
  const filtered = related.filter((p) => p.id !== product.id).slice(0, 3);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name_ar,
    description: product.description_ar || `${product.brand} ${product.name_ar}`,
    brand: { "@type": "Brand", name: product.brand },
    image: product.image_url || undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "ILS",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <ProductDetailClient product={product} related={filtered} />
    </>
  );
}
