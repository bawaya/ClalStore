import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SalesPwaInit } from "@/components/pwa/SalesPwaInit";
import { SalesPwaShell } from "@/components/pwa/SalesPwaShell";
import { ConnectionBanner } from "@/components/pwa/ConnectionBanner";

export const metadata: Metadata = {
  title: "ClalMobile — تطبيق المبيعات",
  description: "تطبيق الموظف الموحّد — مبيعات، عمولات، نشاط، تصحيحات، إعلانات",
  manifest: "/sales-pwa/manifest.json",
  themeColor: "#0b1220",
};

export default function SalesPwaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SalesPwaInit />
      <ConnectionBanner />
      <SalesPwaShell>{children}</SalesPwaShell>
    </>
  );
}
