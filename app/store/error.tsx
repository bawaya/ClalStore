"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Store Error]", error);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="min-h-screen px-4 py-12 text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 26%)",
        backgroundColor: "#111114",
      }}
    >
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[30px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-6 py-10 text-center shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#6a2232] bg-[#2a1016] text-3xl text-[#ff8da0]">
            !
          </div>
          <h2 className="mt-5 text-2xl font-black text-white md:text-[2rem]">حدث خطأ</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-[#b8b8c2] md:text-base">
            عذراً، حدث خلل غير متوقع أثناء عرض المتجر. يمكنك المحاولة مرة أخرى أو العودة
            إلى صفحة التسوق الرئيسية.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={reset}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-6 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f]"
            >
              حاول مجدداً
            </button>
            <Link
              href="/store"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-6 text-sm font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
            >
              العودة إلى المتجر
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
