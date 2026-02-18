"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useScreen } from "@/lib/hooks";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  quickReplies?: string[];
  time: string;
}

export function WebChatWidget() {
  const scr = useScreen();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sessionId] = useState(() => `wc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Welcome message on first open
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        id: "welcome",
        role: "bot",
        text: "أهلاً وسهلاً! 👋\nأنا مساعد ClalMobile — وكيل رسمي لـ HOT Mobile\n\nكيف أقدر أساعدك؟",
        quickReplies: ["📱 المنتجات", "📡 الباقات", "📦 حالة طلبي", "👤 كلم موظف"],
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
    if (open) setUnread(0);
  }, [open, msgs.length]);

  // Focus input when opened
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading || escalated) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      text: text.trim(),
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };
    setMsgs((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId }),
      });
      const data = await res.json();

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: "bot",
        text: data.text || "عذراً، حاول مرة ثانية.",
        quickReplies: data.quickReplies?.length > 0 ? data.quickReplies : undefined,
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      };
      setMsgs((p) => [...p, botMsg]);

      if (data.escalate) setEscalated(true);
      if (!open) setUnread((u) => u + 1);
    } catch {
      setMsgs((p) => [...p, {
        id: `e_${Date.now()}`, role: "bot",
        text: "عذراً حصل خطأ. حاول مرة ثانية! 🔄",
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, escalated, sessionId, open]);

  // === Render formatted text (bold, links) ===
  const renderText = (text: string) => {
    const parts = text.split(/(\*[^*]+\*|https?:\/\/[^\s]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
      }
      if (part.match(/^https?:\/\//)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-brand underline break-all" onClick={(e) => e.stopPropagation()}>
            {part.replace(/https?:\/\/(www\.)?/, "").slice(0, 35)}...
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // === Floating Bubble ===
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[9999] rounded-full shadow-2xl flex items-center justify-center cursor-pointer border-0 transition-transform hover:scale-110"
        style={{
          bottom: scr.mobile ? 16 : 24,
          left: scr.mobile ? 16 : 24,
          width: scr.mobile ? 52 : 60,
          height: scr.mobile ? 52 : 60,
          background: "linear-gradient(135deg, #c41040, #ff3366)",
        }}
      >
        <span style={{ fontSize: scr.mobile ? 22 : 26 }}>💬</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    );
  }

  // === Chat Window ===
  const w = scr.mobile ? "100vw" : 380;
  const h = scr.mobile ? "100vh" : 560;

  return (
    <div
      className="fixed z-[9999] flex flex-col bg-surface-bg text-white overflow-hidden"
      dir="rtl"
      style={{
        width: w,
        height: h,
        bottom: scr.mobile ? 0 : 24,
        left: scr.mobile ? 0 : 24,
        borderRadius: scr.mobile ? 0 : 20,
        border: scr.mobile ? "none" : "1px solid #27272a",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: scr.mobile ? 56 : 52,
          background: "linear-gradient(135deg, #c41040, #8b0a2e)",
        }}
      >
        <button
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full bg-white/10 border-0 text-white cursor-pointer flex items-center justify-center text-sm"
        >
          ✕
        </button>
        <div className="flex items-center gap-2">
          <div>
            <div className="font-bold text-sm text-right">ClalMobile</div>
            <div className="text-[9px] opacity-80 text-right">
              {escalated ? "تم تحويلك لموظف 👤" : "متصل الآن 🟢"}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-black text-sm">C</div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        style={{ background: "#0a0a0c" }}
      >
        {msgs.map((m) => (
          <div key={m.id}>
            <div className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className="max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap"
                style={{
                  fontSize: scr.mobile ? 12 : 13,
                  lineHeight: 1.6,
                  background: m.role === "user" ? "#c41040" : "#18181b",
                  border: m.role === "bot" ? "1px solid #27272a" : "none",
                  borderTopLeftRadius: m.role === "user" ? 4 : 20,
                  borderTopRightRadius: m.role === "bot" ? 4 : 20,
                }}
              >
                {renderText(m.text)}
              </div>
            </div>
            <div className={`text-[8px] text-dim mt-0.5 ${m.role === "user" ? "text-left" : "text-right"}`}>
              {m.time}
            </div>

            {/* Quick Replies */}
            {m.quickReplies && m.quickReplies.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap justify-end">
                {m.quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => send(qr)}
                    disabled={loading || escalated}
                    className="px-2.5 py-1.5 rounded-full border border-brand/40 text-brand text-[10px] font-bold cursor-pointer bg-brand/5 hover:bg-brand/15 transition-colors disabled:opacity-30"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-end">
            <div className="bg-surface-card border border-surface-border rounded-2xl px-4 py-2.5 flex gap-1.5 items-center">
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Escalation Banner */}
      {escalated && (
        <div className="px-4 py-2 bg-yellow-600/20 border-t border-yellow-600/30 text-center text-[11px] text-yellow-300">
          ⏳ تم تحويلك لموظف — سيتواصل معك قريباً
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-center gap-2 border-t border-surface-border flex-shrink-0 bg-surface-card"
        style={{ padding: scr.mobile ? "10px 12px" : "10px 14px" }}
      >
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading || escalated}
          className="w-9 h-9 rounded-full bg-brand text-white border-0 cursor-pointer flex items-center justify-center text-sm disabled:opacity-30 flex-shrink-0"
        >
          ↑
        </button>
        <input
          ref={inputRef}
          className="flex-1 bg-surface-elevated rounded-full border border-surface-border text-white outline-none text-right"
          style={{ padding: "8px 14px", fontSize: scr.mobile ? 12 : 13 }}
          placeholder={escalated ? "بانتظار الموظف..." : "اكتب رسالتك..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          disabled={loading || escalated}
        />
      </div>
    </div>
  );
}
