import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تتبع الطلب | ClalMobile",
  description: "تتبع حالة طلبك من ClalMobile — أدخل رقم الطلب",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
