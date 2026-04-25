"use client";

import { useState, useRef, useEffect } from "react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { csrfHeaders } from "@/lib/csrf-client";
import type { Product } from "@/types/database";

type Msg = { role: "user" | "assistant"; content: string };

export function ProductAssistantWidget({
  page,
  product,
}: {
  page: "smart-home" | "product";
  product?: Product;
}) {
  const scr = useScreen();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/webchat/product-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          messages: next,
          page,
          productId: product?.id,
          lang: lang === "he" ? "he" : "ar",
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `⚠️ ${data.error}` },
        ]);
        return;
      }
      const reply = (data.reply ?? data.data?.reply) as string | undefined;
      if (reply) {
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ تعذر الاتصال. حاول مرة أخرى." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed z-[200] flex cursor-pointer items-center justify-center rounded-full border-2 border-white/10 font-bold text-white shadow-2xl"
        style={{
          bottom: scr.mobile ? 88 : 100,
          left: scr.mobile ? 12 : 24,
          width: scr.mobile ? 52 : 58,
          height: scr.mobile ? 52 : 58,
          background: "linear-gradient(135deg, #ff0e34 0%, #ff3351 100%)",
          boxShadow: "0 18px 36px rgba(0,0,0,0.34)",
          fontSize: 22,
        }}
        aria-label={open ? "إغلاق المساعد" : "فتح المساعد الذكي"}
      >
        {open ? "✕" : "✦"}
      </button>

      {open && (
        <div
          className="fixed z-[199] flex flex-col overflow-hidden rounded-[26px] border border-[#30303a] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] shadow-2xl"
          style={{
            bottom: scr.mobile ? 150 : 168,
            left: scr.mobile ? 10 : 22,
            width: scr.mobile ? "calc(100vw - 20px)" : 380,
            maxHeight: "min(70vh, 480px)",
          }}
        >
          <div
            className="border-b border-[#2f2f38] px-4 py-3 text-sm font-extrabold text-white"
            style={{ background: "linear-gradient(90deg, rgba(255,14,52,0.22), rgba(255,51,81,0.1))" }}
          >
            {lang === "he" ? "עוזר קניות" : "مساعد تسوق ذكي"}
            <span className="me-2 text-[10px] font-normal text-[#b8b8c2]">ClalMobile</span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-right" style={{ minHeight: 200 }}>
            {messages.length === 0 && (
              <p className="p-1 text-[11px] leading-relaxed text-[#b8b8c2]">
                {lang === "he"
                  ? "שאל על מוצרים, השוואות או מחירים. ננסה למצוא לך תשובה מדויקת ומהירה."
                  : "اسأل عن المنتجات أو المقارنات أو الأسعار، وسنحاول إعطاءك إجابة دقيقة وسريعة."}
              </p>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                  m.role === "user"
                    ? "ms-4 border border-[#ff3351]/18 bg-[#ff3351]/10 text-white"
                    : "me-2 border border-[#30303a] bg-white/[0.03] text-[#d6d6dd]"
                }`}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="me-2 animate-pulse text-[11px] text-[#ff8da0]">... جاري</div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex gap-2 border-t border-[#2f2f38] p-3">
            <input
              className="flex-1 rounded-2xl border border-[#3a3a44] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[#8f8f99] focus:border-[#ff3351]/45 focus:bg-white/[0.05]"
              placeholder={lang === "he" ? "שאלה..." : "اكتب سؤالك..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())
              }
            />
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-4 text-xs font-bold text-white transition-colors hover:bg-[#df0d2f] disabled:opacity-40"
            >
              إرسال
            </button>
          </div>
        </div>
      )}
    </>
  );
}
