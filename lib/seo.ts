import type { Metadata } from "next";

const SITE_NAME = "ClalMobile";
const SITE_URL = "https://clalmobile.com";
const DEFAULT_LOCALE = "ar_IL";
const _DEFAULT_CURRENCY = "ILS";

interface ProductSEO {
  name_ar: string;
  name_he: string;
  brand: string;
  price: number;
  image_url?: string;
  description_ar?: string;
  description_he?: string;
}

export function getProductMetadata(product: ProductSEO): Metadata {
  const title = `${product.name_ar} — ${product.brand} | ${SITE_NAME}`;
  const description =
    product.description_ar ||
    `${product.brand} ${product.name_ar} — ₪${product.price}. اشترِ الآن من ${SITE_NAME}.`;

  const images = product.image_url
    ? [{ url: product.image_url, width: 800, height: 800, alt: product.name_ar }]
    : [];

  return {
    title,
    description,
    keywords: [product.brand, product.name_ar, product.name_he, "HOT Mobile", SITE_NAME, "إسرائيل"],
    alternates: {
      canonical: `${SITE_URL}/store`,
      languages: { "ar-IL": `${SITE_URL}/store`, "he-IL": `${SITE_URL}/store` },
    },
    openGraph: {
      title,
      description,
      images,
      type: "website",
      siteName: SITE_NAME,
      locale: DEFAULT_LOCALE,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      description,
      images: product.image_url ? [product.image_url] : undefined,
    },
  };
}

export function getStoreMetadata(): Metadata {
  const title = `${SITE_NAME} — المتجر`;
  const description = "أجهزة وإكسسوارات وباقات HOT Mobile. توصيل لكل إسرائيل.";

  return {
    title,
    description,
    keywords: ["HOT Mobile", SITE_NAME, "أجهزة ذكية", "إكسسوارات", "باقات", "إسرائيل", "متجر إلكتروني"],
    alternates: {
      canonical: `${SITE_URL}/store`,
      languages: { "ar-IL": `${SITE_URL}/store`, "he-IL": `${SITE_URL}/store` },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/store`,
      siteName: SITE_NAME,
      locale: DEFAULT_LOCALE,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

const PAGE_META: Record<string, { title: string; description: string; keywords: string[] }> = {
  cart: {
    title: `سلة المشتريات — ${SITE_NAME}`,
    description: "راجع مشترياتك وأكمل الطلب بسهولة.",
    keywords: ["سلة المشتريات", SITE_NAME],
  },
  checkout: {
    title: `إتمام الشراء — ${SITE_NAME}`,
    description: "أكمل طلبك بأمان. دفع آمن وتوصيل سريع.",
    keywords: ["دفع", "شراء", SITE_NAME],
  },
  wishlist: {
    title: `المفضلة — ${SITE_NAME}`,
    description: "منتجاتك المفضلة محفوظة هنا.",
    keywords: ["المفضلة", SITE_NAME],
  },
  compare: {
    title: `مقارنة المنتجات — ${SITE_NAME}`,
    description: "قارن بين الأجهزة واختر الأنسب لك.",
    keywords: ["مقارنة", "أجهزة", SITE_NAME],
  },
  contact: {
    title: `تواصل معنا — ${SITE_NAME}`,
    description: "تواصل مع فريق ${SITE_NAME}. نحن هنا لمساعدتك.",
    keywords: ["تواصل", "دعم", SITE_NAME],
  },
  account: {
    title: `حسابي — ${SITE_NAME}`,
    description: "إدارة حسابك وطلباتك.",
    keywords: ["حساب", SITE_NAME],
  },
  auth: {
    title: `تسجيل الدخول — ${SITE_NAME}`,
    description: "سجّل دخولك أو أنشئ حساباً جديداً.",
    keywords: ["تسجيل دخول", "حساب جديد", SITE_NAME],
  },
  track: {
    title: `تتبع الطلب — ${SITE_NAME}`,
    description: "تتبع حالة طلبك ومعرفة موعد التوصيل.",
    keywords: ["تتبع", "طلب", "توصيل", SITE_NAME],
  },
};

export function getPageMetadata(page: string): Metadata {
  const meta = PAGE_META[page];
  if (!meta) {
    return {
      title: SITE_NAME,
      description: `${SITE_NAME} — وكيل رسمي لـ HOT Mobile`,
    };
  }

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: `${SITE_URL}/store/${page}`,
      languages: { "ar-IL": `${SITE_URL}/store/${page}`, "he-IL": `${SITE_URL}/store/${page}` },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      url: `${SITE_URL}/store/${page}`,
      siteName: SITE_NAME,
      locale: DEFAULT_LOCALE,
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
    },
  };
}
