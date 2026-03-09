"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import Link from "next/link";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    console.error("[Store Error]", error);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="font-arabic bg-surface-bg text-white min-h-screen flex items-center justify-center"
    >
      <div className="text-center px-4 max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-black mb-2">{t("errors.somethingWrong")}</h1>
        <p className="text-muted mb-6">{t("errors.unexpectedError")}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-button bg-brand font-bold text-white border-0 cursor-pointer hover:bg-brand-light transition-colors"
          >
            {t("errors.tryAgain")}
          </button>
          <Link
            href="/store"
            className="px-6 py-3 rounded-button font-bold text-muted border border-surface-border hover:border-dim transition-colors"
          >
            {t("errors.goStore")}
          </Link>
        </div>
        {error.digest && (
          <p className="text-dim text-[10px] mt-4">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
