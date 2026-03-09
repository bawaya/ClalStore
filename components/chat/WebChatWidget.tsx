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
        <div
          className="absolute inset-0 rounded-full opacity-40 group-hover:opacity-70 transition-opacity"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)",
            transform: "scale(1.6)",
            animation: "pulse 3s ease-in-out infinite",
          }}
        />
        {/* Main button */}
        <div
          className="relative rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 group-hover:scale-110"
          style={{
            width: scr.mobile ? 58 : 62,
            height: scr.mobile ? 58 : 62,
            background: "linear-gradient(135deg, #7c3aed, #c41040, #ec4899)",
            boxShadow: "0 0 30px rgba(124,58,237,0.4), 0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {/* AI sparkle icon */}
          <svg width={scr.mobile ? 26 : 28} height={scr.mobile ? 26 : 28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
            {unread}
          </span>
        )}
        {/* Label */}
        <div
          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
          style={{
            right: scr.mobile ? 66 : 72,
            background: "rgba(15,15,20,0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 12,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "#e2e2e2",
          }}
        >
          AI مساعد ذكي ✨
        </div>

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1.6); opacity: 0.3; }
            50% { transform: scale(2); opacity: 0.6; }
          }
        `}</style>
      </button>
    );
  }

  // === AI Chat Window ===
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
        border: scr.mobile ? "none" : "1px solid rgba(124,58,237,0.2)",
        boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.15)",
        background: "#09090b",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: scr.mobile ? 60 : 56,
          background: "linear-gradient(135deg, #1a1025 0%, #150a20 50%, #0f0515 100%)",
          borderBottom: "1px solid rgba(124,58,237,0.15)",
        }}
      >
        <button
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full border-0 text-white/60 cursor-pointer flex items-center justify-center text-sm hover:text-white hover:bg-white/10 transition-colors"
          style={{ background: "transparent" }}
        >
          ✕
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-black text-sm text-white">ClalMobile AI</div>
            <div className="text-[10px] flex items-center gap-1 justify-end" style={{ color: escalated ? "#fbbf24" : "#a78bfa" }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: escalated ? "#fbbf24" : "#22c55e" }} />
              {escalated ? t("chat.escalated") : t("chat.online")}
            </div>
          </div>
          {/* AI avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
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
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
        style={{ background: "linear-gradient(180deg, #09090b 0%, #0c0612 100%)" }}
      >
        {msgs.map((m) => (
          <div key={m.id}>
            <div className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className="max-w-[85%] px-3.5 py-2.5 whitespace-pre-wrap"
                style={{
                  fontSize: scr.mobile ? 12.5 : 13,
                  lineHeight: 1.7,
                  borderRadius: 18,
                  ...(m.role === "user"
                    ? {
                        background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                        color: "#fff",
                        borderBottomLeftRadius: 4,
                      }
                    : {
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(124,58,237,0.12)",
                        color: "#e4e4e7",
                        borderBottomRightRadius: 4,
                      }),
                }}
              >
                {m.role === "bot" && (
                  <span className="text-[9px] font-bold block mb-1" style={{ color: "#a78bfa" }}>
                    ✨ AI
                  </span>
                )}
                {renderText(m.text)}
              </div>
            </div>
            <div className={`text-[8px] mt-0.5 ${m.role === "user" ? "text-left" : "text-right"}`} style={{ color: "#52525b" }}>
              {m.time}
            </div>

            {m.quickReplies && m.quickReplies.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap justify-end">
                {m.quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => send(qr)}
                    disabled={loading || escalated}
                    className="cursor-pointer transition-all duration-200 disabled:opacity-30"
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: "1px solid rgba(124,58,237,0.3)",
                      background: "rgba(124,58,237,0.08)",
                      color: "#c4b5fd",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.2)"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.6)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.08)"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)"; }}
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div
              className="rounded-2xl px-4 py-3 flex gap-2 items-center"
              style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.12)" }}
            >
              <span className="text-[9px] font-bold" style={{ color: "#a78bfa" }}>✨ AI</span>
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#7c3aed", animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#7c3aed", animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#7c3aed", animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Escalation Banner */}
      {escalated && (
        <div className="px-4 py-2 text-center text-[11px] font-bold" style={{ background: "rgba(251,191,36,0.1)", borderTop: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
          {t("chat.escalatedBanner")}
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        style={{
          padding: scr.mobile ? "12px 14px" : "12px 16px",
          paddingBottom: scr.mobile ? "calc(12px + env(safe-area-inset-bottom, 0px))" : "12px",
          background: "#0f0f12",
          borderTop: "1px solid rgba(124,58,237,0.1)",
        }}
      >
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading || escalated}
          className="flex-shrink-0 border-0 cursor-pointer flex items-center justify-center transition-all duration-200 disabled:opacity-30"
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            background: input.trim() && !loading ? "linear-gradient(135deg, #7c3aed, #c41040)" : "rgba(255,255,255,0.05)",
            boxShadow: input.trim() && !loading ? "0 0 20px rgba(124,58,237,0.3)" : "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
        <input
          ref={inputRef}
          className="flex-1 text-white outline-none text-right"
          style={{
            padding: "10px 16px",
            fontSize: scr.mobile ? 13 : 13.5,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(124,58,237,0.15)",
            borderRadius: 14,
          }}
          placeholder={escalated ? t("chat.waitingAgent") : "اسأل المساعد الذكي..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          disabled={loading || escalated}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.15)"; }}
        />
      </div>
    </div>
  );
}
