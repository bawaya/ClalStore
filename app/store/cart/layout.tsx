import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سلة التسوق | ClalMobile",
  description:
    "أكمل طلبك من ClalMobile — أجهزة ذكية وإكسسوارات مع توصيل لكل إسرائيل",
  openGraph: {
    title: "سلة التسوق | ClalMobile",
    description:
      "أكمل طلبك من ClalMobile — أجهزة ذكية وإكسسوارات مع توصيل لكل إسرائيل",
    url: "https://clalmobile.com/store/cart",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
