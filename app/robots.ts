import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/crm", "/api"] },
    ],
    sitemap: "https://clalmobile.com/sitemap.xml",
  };
}
