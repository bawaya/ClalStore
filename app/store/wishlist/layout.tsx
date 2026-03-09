import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "قائمة الأمنيات | ClalMobile",
  description:
    "منتجاتك المفضلة في ClalMobile — أجهزة ذكية وإكسسوارات",
  openGraph: {
    title: "قائمة الأمنيات | ClalMobile",
    description:
      "منتجاتك المفضلة في ClalMobile — أجهزة ذكية وإكسسوارات",
    url: "https://clalmobile.com/store/wishlist",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
