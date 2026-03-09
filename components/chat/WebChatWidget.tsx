"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  quickReplies?: string[];
  time: string;
}

export function WebChatWidget() {
  const scr = useScreen();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = sessionStorage.getItem("clal_webchat_msgs");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("clal_webchat_escalated") === "true";
  });
  const [unread, setUnread] = useState(0);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return `wc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const stored = sessionStorage.getItem("clal_webchat_session");
    if (stored) return stored;
    const id = `wc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem("clal_webchat_session", id);
    return id;
  });
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    try { sessionStorage.setItem("clal_webchat_msgs", JSON.stringify(msgs.slice(-50))); } catch {}
  }, [msgs]);

  useEffect(() => {
    try { sessionStorage.setItem("clal_webchat_escalated", String(escalated)); } catch {}
  }, [escalated]);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        id: "welcome",
        role: "bot",
        text: t("chat.welcome"),
        quickReplies: [t("chat.qr1"), t("chat.qr2"), t("chat.qr3"), t("chat.qr4")],
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
    if (open) setUnread(0);
  }, [open, msgs.length]);

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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, escalated, sessionId, open]);

  const renderText = (text: string) => {
    const parts = text.split(/(\*[^*]+\*|https?:\/\/[^\s]+|0\d{1,2}[- ]?\d{3}[- ]?\d{4})/g);
    return parts.map((part, i) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
      }
      if (/^0\d{1,2}[- ]?\d{3}[- ]?\d{4}$/.test(part)) {
        const clean = part.replace(/[-\s]/g, "");
        const intl = "972" + clean.slice(1);
        return (
          <span key={i} className="inline-flex gap-1.5 flex-wrap">
            <a href={`tel:${clean}`} className="text-brand underline" onClick={(e) => e.stopPropagation()}>📞 {part}</a>
            <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer"
              className="text-green-400 underline" onClick={(e) => e.stopPropagation()}>💬 واتساب</a>
          </span>
        );
      }
      if (part.match(/^https?:\/\//)) {
        const label = part.includes("wa.me") ? "💬 واتساب" : part.replace(/https?:\/\/(www\.)?/, "").slice(0, 35) + (part.length > 40 ? "..." : "");
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-brand underline break-all" onClick={(e) => e.stopPropagation()}>
            {label}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // === AI Floating Bubble ===
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[9999] group cursor-pointer border-0"
        style={{
          bottom: scr.mobile ? 20 : 28,
          left: scr.mobile ? 14 : 28,
          marginBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-500"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)",
            transform: "scale(1.8)",
            animation: "pulse 3s ease-in-out infinite",
          }}
        />
        {/* Main bubble */}
        <div
          className="relative flex items-center justify-center rounded-full shadow-2xl transition-all duration-300 group-hover:scale-110"
          style={{
            width: scr.mobile ? 58 : 62,
            height: scr.mobile ? 58 : 62,
            background: "linear-gradient(135deg, #7c3aed, #c41040, #ec4899)",
            boxShadow: "0 8px 32px rgba(124,58,237,0.4), 0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {/* AI sparkle icon */}
          <svg width={scr.mobile ? 26 : 28} height={scr.mobile ? 26 : 28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
            {unread}
          </span>
        )}
        {/* Label */}
        <div
          className="absolute whitespace-nowrap bg-white/10 backdrop-blur-md text-white text-[10px] font-bold rounded-full px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          AI مساعد ذكي
        </div>
        <style>{`@keyframes pulse { 0%, 100% { transform: scale(1.6); opacity: 0.3; } 50% { transform: scale(2); opacity: 0.5; } }`}</style>
      </button>
    );
  }

  // === Chat Window ===
  const w = scr.mobile ? "100vw" : 400;

  return (
    <div
      className="fixed z-[9999] flex flex-col overflow-hidden"
      dir="rtl"
      style={{
        width: w,
        height: scr.mobile ? "100dvh" : 580,
        bottom: scr.mobile ? 0 : 28,
        left: scr.mobile ? 0 : 28,
        borderRadius: scr.mobile ? 0 : 24,
        border: scr.mobile ? "none" : "1px solid rgba(124,58,237,0.25)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.15)",
        background: "#09090b",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: scr.mobile ? 60 : 56,
          background: "linear-gradient(135deg, #18082e, #1a0a2e, #200a1e)",
          borderBottom: "1px solid rgba(124,58,237,0.2)",
        }}
      >
        <button
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full border-0 text-white/60 cursor-pointer flex items-center justify-center text-sm hover:bg-white/10 hover:text-white transition-colors"
          style={{ background: "transparent" }}
        >
          ✕
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-bold text-sm text-white">ClalMobile AI</div>
            <div className="text-[10px] flex items-center gap-1 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" style={{ animation: "pulse 2s infinite" }} />
              <span className="text-green-400/80">
                {escalated ? t("chat.escalated") : t("chat.online")}
              </span>
            </div>
          </div>
          {/* AI Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #c41040)",
              boxShadow: "0 0 16px rgba(124,58,237,0.4)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
        style={{ background: "#09090b" }}
      >
        {msgs.map((m) => (
          <div key={m.id}>
            <div className={`flex ${m.role === "user" ? "justify-start" : "justify-end"} items-end gap-1.5`}>
              {/* Bot avatar (small) */}
              {m.role === "bot" && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 order-1"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #c41040)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                </div>
              )}
              <div
                className="max-w-[80%] px-3.5 py-2.5 whitespace-pre-wrap"
                style={{
                  fontSize: scr.mobile ? 12.5 : 13.5,
                  lineHeight: 1.65,
                  borderRadius: m.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                  background: m.role === "user"
                    ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                    : "rgba(255,255,255,0.05)",
                  border: m.role === "bot" ? "1px solid rgba(255,255,255,0.08)" : "none",
                  color: m.role === "user" ? "#fff" : "#e4e4e7",
                }}
              >
                {renderText(m.text)}
              </div>
            </div>
            <div className={`text-[8px] text-zinc-600 mt-0.5 px-8 ${m.role === "user" ? "text-left" : "text-right"}`}>
              {m.time}
            </div>

            {/* Quick Replies */}
            {m.quickReplies && m.quickReplies.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap justify-end pr-8">
                {m.quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => send(qr)}
                    disabled={loading || escalated}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 disabled:opacity-30 hover:scale-105"
                    style={{
                      background: "rgba(124,58,237,0.1)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      color: "#a78bfa",
                    }}
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
          <div className="flex justify-end items-end gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #c41040)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Escalation Banner */}
      {escalated && (
        <div className="px-4 py-2.5 text-center text-[11px] font-medium"
          style={{ background: "rgba(234,179,8,0.08)", borderTop: "1px solid rgba(234,179,8,0.15)", color: "#fbbf24" }}>
          {t("chat.escalatedBanner")}
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        style={{
          padding: scr.mobile ? "12px 14px" : "12px 16px",
          paddingBottom: scr.mobile ? "calc(12px + env(safe-area-inset-bottom, 0px))" : "12px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading || escalated}
          className="flex-shrink-0 border-0 cursor-pointer flex items-center justify-center transition-all duration-200 disabled:opacity-20 hover:scale-110"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: !input.trim() || loading ? "rgba(124,58,237,0.15)" : "linear-gradient(135deg, #7c3aed, #c41040)",
            boxShadow: input.trim() && !loading ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none text-white text-right"
          style={{
            padding: "10px 16px",
            fontSize: scr.mobile ? 13 : 14,
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          placeholder={escalated ? t("chat.waitingAgent") : t("chat.placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          disabled={loading || escalated}
        />
      </div>

      {/* Powered by */}
      <div className="text-center pb-2 text-[9px] text-zinc-700">
        Powered by <span className="text-violet-500/60 font-semibold">ClalMobile AI</span>
      </div>
    </div>
  );
}
