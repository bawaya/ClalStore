"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin Error]", error);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="font-arabic bg-surface-bg text-white min-h-screen flex items-center justify-center"
    >
      <div className="text-center px-4 max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-black mb-2">حصل خطأ في لوحة الإدارة</h1>
        <p className="text-muted mb-6">
          حصل خطأ غير متوقع. حاول مرة ثانية أو ارجع للرئيسية.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-button bg-brand font-bold text-white border-0 cursor-pointer hover:bg-brand-light transition-colors"
          >
            🔄 حاول مرة ثانية
          </button>
          <a
            href="/admin"
            className="px-6 py-3 rounded-button font-bold text-muted border border-surface-border hover:border-dim transition-colors"
          >
            🏠 لوحة التحكم
          </a>
        </div>
        {error.digest && (
          <p className="text-dim text-[10px] mt-4">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
