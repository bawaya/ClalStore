// =====================================================
// ClalMobile — Message Input Area + AI Smart Reply
// =====================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { InboxTemplate, InboxQuickReply } from "@/lib/crm/inbox-types";
import { QuickReplies } from "./QuickReplies";
import { TemplateSelector } from "./TemplateSelector";

interface Props {
  conversationId: string;
  onSend: (data: {
    type: string;
    content?: string;
    template_name?: string;
    template_params?: Record<string, string>;
    media_url?: string;
    media_filename?: string;
  }) => Promise<void>;
  templates: InboxTemplate[];
  quickReplies: InboxQuickReply[];
  disabled?: boolean;
  disabledReason?: string;
  outsideWindow?: boolean;
}

export function MessageInput({
  conversationId,
  onSend,
  templates,
  quickReplies,
  disabled,
  disabledReason,
  outsideWindow,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [aiError, setAiError] = useState("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [text]);

  /* Send text message */
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setAiSuggested(false);
    try {
      await onSend({ type: "text", content: trimmed });
      setText("");
    } catch {}
    setSending(false);
    textareaRef.current?.focus();
  }, [text, sending, onSend]);

  /* Handle keyboard */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Quick reply shortcut: / at start
    if (e.key === "/" && text === "") {
      setShowQuick(true);
    }
    // Smart reply shortcut: Ctrl+Shift+S
    if (e.key === "S" && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      handleSmartReply();
    }
  };

  /* Quick reply selection */
  const handleQuickReply = (content: string) => {
    setText(content);
    setShowQuick(false);
    textareaRef.current?.focus();
  };

  /* Template selection */
  const handleTemplate = async (
    template: InboxTemplate,
    variables: Record<string, string>
  ) => {
    setSending(true);
    try {
      await onSend({
        type: "template",
        template_name: template.name,
        template_params: variables,
        content: template.content,
      });
    } catch {}
    setSending(false);
    setShowTemplates(false);
  };

  /* AI Smart Reply */
  const handleSmartReply = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiSuggested(false);
    try {
      const res = await fetch(`/api/crm/inbox/${conversationId}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.suggestion) {
        setText(data.suggestion);
        setAiSuggested(true);
        textareaRef.current?.focus();
      } else {
        setAiError(data.error || "تعذر اقتراح رد — حاول مجدداً");
        setTimeout(() => setAiError(""), 3000);
      }
    } catch {
      setAiError("تعذر اقتراح رد — حاول مجدداً");
      setTimeout(() => setAiError(""), 3000);
    }
    setAiLoading(false);
  }, [conversationId, aiLoading]);

  /* Dismiss AI suggestion */
  const dismissSuggestion = () => {
    setText("");
    setAiSuggested(false);
    textareaRef.current?.focus();
  };

  /* File upload handler */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    // Reset input so same file can be selected again
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/crm/inbox/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        setAiError(data.error || "فشل رفع الملف");
        setTimeout(() => setAiError(""), 3000);
        setUploading(false);
        return;
      }

      await onSend({
        type: data.type,
        content: text.trim() || undefined,
        media_url: data.url,
        media_filename: data.filename,
      });
      setText("");
    } catch {
      setAiError("فشل رفع الملف — حاول مجدداً");
      setTimeout(() => setAiError(""), 3000);
    }
    setUploading(false);
  }, [uploading, onSend, text]);

  /* Disabled state */
  if (disabled) {
    return (
      <div className="px-4 py-3 bg-surface-card border-t border-surface-border text-center">
        <p className="text-sm text-muted">{disabledReason || "لا يمكن الإرسال"}</p>
      </div>
    );
  }

  return (
    <div className="relative bg-surface-card border-t border-surface-border">
      {/* Popups */}
      {showQuick && (
        <QuickReplies
          replies={quickReplies}
          onSelect={handleQuickReply}
          onClose={() => setShowQuick(false)}
        />
      )}
      {showTemplates && (
        <TemplateSelector
          templates={templates}
          onSelect={handleTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* 24h warning */}
      {outsideWindow && (
        <div className="px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 text-center">
          <p className="text-xs text-yellow-400">
            ⚠️ مرت 24 ساعة — يمكنك فقط إرسال قوالب
          </p>
        </div>
      )}

      {/* AI suggestion banner */}
      {aiSuggested && (
        <div className="flex items-center justify-between px-3 py-2 bg-purple-500/10 border-b border-purple-500/20">
          <span className="text-xs text-purple-300">
            ✨ رد مقترح — يمكنك تعديله قبل الإرسال
          </span>
          <button
            onClick={dismissSuggestion}
            className="text-xs text-purple-400 hover:text-white transition-colors"
          >
            تجاهل ❌
          </button>
        </div>
      )}

      {/* AI error toast */}
      {aiError && (
        <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-center">
          <p className="text-xs text-red-400">⚠️ {aiError}</p>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Toolbar: attachment, quick reply, template, AI */}
        <div className="flex gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || outsideWindow}
            className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface-elevated transition-colors disabled:opacity-50"
            title="إرفاق صورة أو مستند"
          >
            {uploading ? (
              <span className="animate-spin text-sm">⏳</span>
            ) : (
              <span className="text-sm">📎</span>
            )}
          </button>
          <button
            onClick={() => {
              setShowQuick(!showQuick);
              setShowTemplates(false);
            }}
            className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface-elevated transition-colors"
            title="ردود سريعة"
          >
            ⚡
          </button>
          <button
            onClick={() => {
              setShowTemplates(!showTemplates);
              setShowQuick(false);
            }}
            className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface-elevated transition-colors"
            title="قوالب"
          >
            📋
          </button>
          <button
            onClick={handleSmartReply}
            disabled={aiLoading || outsideWindow}
            className="p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: aiLoading
                ? "rgba(139,92,246,0.2)"
                : "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(196,16,64,0.15))",
              color: aiLoading ? "#a78bfa" : "#c084fc",
            }}
            title="اقتراح رد ذكي بالذكاء الاصطناعي (Ctrl+Shift+S)"
          >
            {aiLoading ? (
              <span className="animate-spin text-sm">⏳</span>
            ) : (
              <span className="text-sm">✨</span>
            )}
          </button>
        </div>

        {/* Textarea */}
        <div className="flex-1">
          {aiLoading && (
            <div className="text-xs text-purple-400 mb-1 animate-pulse">
              🧠 جاري التفكير...
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (aiSuggested) setAiSuggested(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder={outsideWindow ? "استخدم قالب للإرسال..." : "اكتب رسالة..."}
            rows={1}
            disabled={outsideWindow}
            className={`w-full bg-surface-bg border rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              aiSuggested
                ? "border-purple-500/40 focus:border-purple-500"
                : "border-surface-border focus:border-[#c41040]"
            }`}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || outsideWindow}
          className="p-2.5 rounded-xl bg-[#c41040] text-white hover:bg-[#a30d35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <span className="animate-spin text-sm">⏳</span>
          ) : (
            <span className="text-sm">📤</span>
          )}
        </button>
      </div>
    </div>
  );
}
