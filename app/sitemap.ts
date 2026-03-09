import { MetadataRoute } from "next";
import { createAdminSupabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://clalmobile.com";

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/store`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/deals`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  let productPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createAdminSupabase();
    const { data: products } = await supabase
      .from("products")
      .select("id, updated_at")
      .eq("active", true)
      .order("updated_at", { ascending: false });

    if (products) {
      productPages = products.map((p: any) => ({
        url: `${base}/store/product/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
  } catch (err) {
    console.error("Sitemap: failed to load products", err);
  }

  return [...staticPages, ...productPages];
}
