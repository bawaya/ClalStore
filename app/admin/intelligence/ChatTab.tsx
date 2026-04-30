"use client";

import { useState, useRef, useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import type { BulkAction } from "@/lib/intelligence/schemas";

interface Turn {
  role: "user" | "assistant";
  content: string;
  action?: BulkAction | null;
}

export function ChatTab() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, loading]);

  const ask = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setError("");

    const newHistory: Turn[] = [
      ...history,
      { role: "user", content: question },
    ];
    setHistory(newHistory);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/intelligence/chat", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          question,
          history: history.map((h) => ({ role: h.role, content: h.content })),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const data = json.data as { text: string; action: BulkAction | null };
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.action
            ? "📋 خطة عمل مُقترحة:"
            : data.text || "(بلا رد)",
          action: data.action,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإرسال");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        اسأل الكتالوج بأي لغة. مثال: &quot;كم منتج Apple عندي؟&quot;، &quot;ما المنتجات الأغلى؟&quot;.
      </p>

      <div
        ref={scrollRef}
        className="card p-3 max-h-[400px] overflow-y-auto space-y-3"
      >
        {history.length === 0 && (
          <div className="text-center text-muted text-xs py-8">
            ابدأ المحادثة بسؤال…
          </div>
        )}
        {history.map((t, i) => (
          <div
            key={i}
            className={`text-sm ${
              t.role === "user" ? "text-right" : "text-right"
            }`}
          >
            <div className="text-[10px] text-muted mb-1">
              {t.role === "user" ? "🙋 أنت" : "🧠 Opus"}
            </div>
            <div
              className={`p-2 rounded-lg ${
                t.role === "user"
                  ? "bg-brand/10 border border-brand/30"
                  : "bg-surface-elev border border-surface-border"
              } whitespace-pre-wrap`}
            >
              {t.content}
              {t.action && <ActionPreview action={t.action} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-brand">⏳ Opus يفكر...</div>
        )}
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          disabled={loading}
          placeholder="اكتب سؤالك..."
          className="flex-1 p-2 rounded-lg border border-surface-border bg-transparent text-sm"
        />
        <button
          onClick={ask}
          disabled={loading || !input.trim()}
          className="chip chip-active"
        >
          إرسال
        </button>
      </div>
    </div>
  );
}

function ActionPreview({ action }: { action: BulkAction }) {
  return (
    <div className="mt-2 p-2 rounded-lg bg-surface-base border border-surface-border text-xs space-y-1">
      <div>
        <span className="text-muted">العملية:</span> <b>{action.action}</b>
      </div>
      <div>
        <span className="text-muted">عدد المتأثرين:</span>{" "}
        <b>{action.estimated_count}</b>
      </div>
      <div>
        <span className="text-muted">الفلتر:</span>
        <pre className="font-mono text-[10px] mt-1 whitespace-pre-wrap">
          {JSON.stringify(action.filter, null, 2)}
        </pre>
      </div>
      <div>
        <span className="text-muted">التغييرات:</span>
        <pre className="font-mono text-[10px] mt-1 whitespace-pre-wrap">
          {JSON.stringify(action.changes, null, 2)}
        </pre>
      </div>
      <div className="text-[10px] text-muted italic mt-2">
        ⚠️ التطبيق التلقائي للأوامر الجماعية معطّل في هذه الواجهة. راجع الخطة، ثم نفّذها يدوياً عبر صفحات الكتالوج.
      </div>
    </div>
  );
}
