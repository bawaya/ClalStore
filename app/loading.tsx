"use client";

import { useLang } from "@/lib/i18n";

export default function Loading() {
  const { t } = useLang();
  return (
    <div className="bg-surface-bg text-white min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-brand border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-muted text-sm">{t("common.loading")}</p>
      </div>
    </div>
  );
}
