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
        className="fixed z-[200] flex items-center justify-center rounded-full shadow-2xl border-2 border-white/10 text-white font-bold cursor-pointer"
        style={{
          bottom: scr.mobile ? 88 : 100,
          left: scr.mobile ? 12 : 24,
          width: scr.mobile ? 52 : 58,
          height: scr.mobile ? 52 : 58,
          background: "linear-gradient(135deg, #7c3aed 0%, #c41040 100%)",
          fontSize: 22,
        }}
        aria-label={open ? "إغلاق المساعد" : "فتح المساعد الذكي"}
      >
        {open ? "✕" : "✨"}
      </button>

      {open && (
        <div
          className="fixed z-[199] flex flex-col rounded-2xl border border-white/10 bg-surface-card shadow-2xl overflow-hidden"
          style={{
            bottom: scr.mobile ? 150 : 168,
            left: scr.mobile ? 10 : 22,
            width: scr.mobile ? "calc(100vw - 20px)" : 380,
            maxHeight: "min(70vh, 480px)",
          }}
        >
          <div
            className="px-3 py-2 font-extrabold text-sm text-white border-b border-white/10"
            style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.35), rgba(196,16,64,0.2))" }}
          >
            ✨ {lang === "he" ? "עוזר קניות" : "مساعد تسوّق ذكي"}
            <span className="text-[10px] text-muted font-normal me-2">ClalHome + بحث</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 text-right" style={{ minHeight: 200 }}>
            {messages.length === 0 && (
              <p className="text-[11px] text-muted p-1 leading-relaxed">
                {lang === "he"
                  ? "שאל על מוצרים, השוואות, או מחירים. ננסה לחפש ברשת כשצריך."
                  : "اسأل عن المنتجات، المقارنات، أو الأسعار. نبحث في الويب عند الحاجة."}
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-[12px] leading-relaxed rounded-xl px-2.5 py-1.5 ${
                  m.role === "user" ? "bg-brand/15 text-white ms-4" : "bg-surface-elevated text-muted me-2"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="text-[11px] text-purple-300 animate-pulse me-2">… جاري</div>
            )}
            <div ref={endRef} />
          </div>
          <div className="p-2 border-t border-surface-border flex gap-1">
            <input
              className="flex-1 bg-surface-elevated border border-surface-border rounded-xl px-2 py-1.5 text-sm text-white outline-none"
              placeholder={lang === "he" ? "שאלה…" : "اكتب سؤالك…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())}
            />
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-bold disabled:opacity-40"
            >
              إرسال
            </button>
          </div>
        </div>
      )}
    </>
  );
}
