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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-bold text-white">حدث خطأ في لوحة التحكم</h2>
      <p className="text-muted text-sm max-w-md">
        حدث خطأ غير متوقع. يمكنك المحاولة مجدداً أو العودة للصفحة الرئيسية.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="btn-primary px-6 py-2 rounded-xl font-bold text-sm"
        >
          حاول مجدداً
        </button>
        <a
          href="/admin"
          className="px-6 py-2 rounded-xl border border-surface-border text-muted text-sm hover:text-white transition"
        >
          الصفحة الرئيسية
        </a>
      </div>
    </div>
  );
}
