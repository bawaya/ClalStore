"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#09090b] text-white font-sans min-h-screen flex items-center justify-center" style={{ backgroundColor: '#09090b', color: '#fafafa' }}>
        <div className="text-center px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-black mb-2">حصل خطأ!</h1>
          <p className="text-[#a1a1aa] mb-6 max-w-md mx-auto">
            عذراً، حصل خطأ غير متوقع. الفريق تم إبلاغه تلقائياً.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 rounded-xl font-bold text-white border-0 cursor-pointer"
              style={{ background: "#c41040" }}
            >
              🔄 حاول مرة ثانية
            </button>
            <a
              href="/"
              className="px-6 py-3 rounded-xl font-bold text-[#a1a1aa] border border-[#27272a]"
              style={{ textDecoration: "none" }}
            >
              🏠 الرئيسية
            </a>
          </div>
          {error.digest && (
            <p className="text-[#52525b] text-[10px] mt-4">Error ID: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
