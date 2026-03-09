import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تم الطلب بنجاح | ClalMobile",
  description: "شكراً لطلبك من ClalMobile",
  robots: { index: false, follow: false },
  openGraph: {
    title: "تم الطلب بنجاح | ClalMobile",
    description: "شكراً لطلبك من ClalMobile",
    url: "https://clalmobile.com/store/checkout/success",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
