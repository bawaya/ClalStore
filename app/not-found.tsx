"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen flex items-center justify-center">
      <div className="text-center px-4">
        <div className="text-7xl mb-4">🔍</div>
        <h1 className="text-4xl font-black mb-2">404</h1>
        <h2 className="text-xl font-bold text-muted mb-4">{t("errors.pageNotFound")}</h2>
        <p className="text-muted mb-6">{t("errors.pageNotFoundDesc")}</p>
        <div className="flex gap-3 justify-center">
          <Link href="/store" className="btn-primary">{t("errors.goStore")}</Link>
          <Link href="/" className="btn-outline">{t("errors.goHome")}</Link>
        </div>
      </div>
    </div>
  );
}
