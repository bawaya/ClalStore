import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تواصل معنا | ClalMobile",
  description:
    "تواصل مع فريق ClalMobile — وكيل رسمي لـ HOT Mobile في إسرائيل",
  openGraph: {
    title: "تواصل معنا | ClalMobile",
    description:
      "تواصل مع فريق ClalMobile — وكيل رسمي لـ HOT Mobile في إسرائيل",
    url: "https://clalmobile.com/store/contact",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
