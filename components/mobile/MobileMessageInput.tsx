// =====================================================
// ClalMobile — Mobile Message Input + Templates + Quick Replies
// =====================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { InboxTemplate, InboxQuickReply } from "@/lib/crm/inbox-types";
import { csrfHeaders } from "@/lib/csrf-client";

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
  outsideWindow?: boolean;
}

type Panel = "none" | "templates" | "quick" | "ai";

export function MobileMessageInput({
  conversationId,
  onSend,
  templates,
  quickReplies,
  outsideWindow,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<InboxTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 100) + "px";
    }
  }, [text]);

  /* Send text */
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
  }, [text, sending, onSend]);

  /* Send template */
  const handleSendTemplate = useCallback(async (template: InboxTemplate, vars: Record<string, string>) => {
    setSending(true);
    try {
      await onSend({
        type: "template",
        template_name: template.name,
        template_params: vars,
        content: template.content,
      });
      setPanel("none");
      setSelectedTemplate(null);
      setTemplateVars({});
    } catch {}
    setSending(false);
  }, [onSend]);

  /* Quick reply */
  const handleQuickReply = (content: string) => {
    setText(content);
    setPanel("none");
    textareaRef.current?.focus();
  };

  /* AI Smart Reply */
  const handleSmartReply = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/crm/inbox/${conversationId}/suggest`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.suggestion) {
        setText(data.suggestion);
        setAiSuggested(true);
        setPanel("none");
        textareaRef.current?.focus();
      }
    } catch {}
    setAiLoading(false);
  }, [conversationId, aiLoading]);

  /* File upload */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    e.target.value = "";
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/crm/inbox/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        await onSend({
          type: data.type,
          content: text.trim() || undefined,
          media_url: data.url,
          media_filename: data.filename,
        });
        setText("");
      }
    } catch {}
    setUploading(false);
  }, [uploading, onSend, text]);

  /* Keyboard */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const togglePanel = (p: Panel) => {
    setPanel(panel === p ? "none" : p);
    setSelectedTemplate(null);
    setTemplateVars({});
    setTemplateSearch("");
    setQuickSearch("");
  };

  /* Filter templates */
  const filteredTemplates = templates.filter(
    (t) => t.is_active && (!templateSearch || t.name.includes(templateSearch) || t.content.includes(templateSearch))
  );

  const filteredQuickReplies = quickReplies.filter(
    (q) => q.is_active && (!quickSearch || q.title.includes(quickSearch) || q.content.includes(quickSearch) || q.shortcut.includes(quickSearch))
  );

  /* Template variable form */
  const templateVarNames = selectedTemplate?.variables || [];
  const allVarsFilled = templateVarNames.every((v) => (templateVars[v] || "").trim());

  return (
    <div className="bg-surface-card border-t border-surface-border safe-bottom">
      {/* Panels */}
      {panel === "templates" && (
        <div className="max-h-[45dvh] overflow-y-auto border-b border-surface-border">
          {selectedTemplate ? (
            /* Template variable form */
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelectedTemplate(null)} className="text-xs text-muted hover:text-white">
                  → رجوع
                </button>
                <p className="text-sm font-semibold text-white">{selectedTemplate.name}</p>
              </div>

              {/* Preview */}
              <div className="bg-surface-elevated rounded-lg p-3 text-xs text-white/70 leading-relaxed">
                {selectedTemplate.content.replace(
                  /\{\{?(\w+)\}?\}/g,
                  (_, v) => templateVars[v] || `[${v}]`
                )}
              </div>

              {/* Variables */}
              {templateVarNames.map((v) => (
                <div key={v}>
                  <label className="text-xs text-muted block mb-1">{v}</label>
                  <input
                    type="text"
                    value={templateVars[v] || ""}
                    onChange={(e) => setTemplateVars({ ...templateVars, [v]: e.target.value })}
                    className="w-full bg-surface-elevated text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand/50"
                    placeholder={`أدخل ${v}...`}
                  />
                </div>
              ))}

              <button
                onClick={() => handleSendTemplate(selectedTemplate, templateVars)}
                disabled={!allVarsFilled || sending}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-brand text-white disabled:opacity-50 transition-colors"
              >
                {sending ? "جاري الإرسال..." : "إرسال القالب 📤"}
              </button>
            </div>
          ) : (
            /* Template list */
            <div className="p-3">
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="بحث في القوالب..."
                className="w-full bg-surface-elevated text-white text-sm rounded-lg px-3 py-2 mb-2 outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted"
              />
              {filteredTemplates.length === 0 ? (
                <p className="text-center text-muted text-sm py-4">لا توجد قوالب</p>
              ) : (
                <div className="space-y-1">
                  {filteredTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (t.variables.length > 0) {
                          setSelectedTemplate(t);
                          setTemplateVars({});
                        } else {
                          handleSendTemplate(t, {});
                        }
                      }}
                      className="w-full text-right px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors"
                    >
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <p className="text-xs text-muted truncate mt-0.5">{t.content}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {panel === "quick" && (
        <div className="max-h-[45dvh] overflow-y-auto border-b border-surface-border p-3">
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="بحث في الردود السريعة..."
            className="w-full bg-surface-elevated text-white text-sm rounded-lg px-3 py-2 mb-2 outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted"
          />
          {filteredQuickReplies.length === 0 ? (
            <p className="text-center text-muted text-sm py-4">لا توجد ردود سريعة</p>
          ) : (
            <div className="space-y-1">
              {filteredQuickReplies.map((q) => (
                <button
                  key={q.id}
                  onClick={() => handleQuickReply(q.content)}
                  className="w-full text-right px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-brand font-mono">/{q.shortcut}</span>
                    <p className="text-sm text-white">{q.title}</p>
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">{q.content}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 24h window warning */}
      {outsideWindow && (
        <div className="px-3 py-1.5 bg-yellow-500/10 text-center">
          <p className="text-[11px] text-yellow-400">⚠️ مرت 24 ساعة — يمكنك فقط إرسال قوالب</p>
        </div>
      )}

      {/* AI suggestion banner */}
      {aiSuggested && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-purple-500/10">
          <span className="text-[11px] text-purple-300">✨ رد مقترح — عدّله وأرسل</span>
          <button onClick={() => { setText(""); setAiSuggested(false); }} className="text-[11px] text-purple-400">
            تجاهل ❌
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-1.5 p-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Toolbar */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || outsideWindow}
            className="p-2 rounded-lg text-muted hover:text-white transition-colors disabled:opacity-40 text-sm"
          >
            {uploading ? <span className="animate-spin">⏳</span> : "📎"}
          </button>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={outsideWindow ? "أرسل قالباً..." : "اكتب رسالة..."}
            disabled={outsideWindow}
            rows={1}
            className="w-full bg-surface-elevated text-white text-sm rounded-2xl px-4 py-2.5 resize-none outline-none focus:ring-1 focus:ring-brand/40 placeholder:text-muted disabled:opacity-50"
            style={{ maxHeight: 100 }}
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-0.5">
          {text.trim() ? (
            <button
              onClick={handleSend}
              disabled={sending}
              className="p-2.5 rounded-full bg-brand text-white transition-colors disabled:opacity-50"
            >
              <span className="text-sm">{sending ? "⏳" : "📤"}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => togglePanel("quick")}
                className={`p-2 rounded-lg transition-colors text-sm ${panel === "quick" ? "text-brand" : "text-muted hover:text-white"}`}
              >
                ⚡
              </button>
              <button
                onClick={() => togglePanel("templates")}
                className={`p-2 rounded-lg transition-colors text-sm ${panel === "templates" ? "text-brand" : "text-muted hover:text-white"}`}
              >
                📋
              </button>
              <button
                onClick={handleSmartReply}
                disabled={aiLoading || outsideWindow}
                className="p-2 rounded-lg text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-40 text-sm"
              >
                {aiLoading ? <span className="animate-spin">⏳</span> : "🤖"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
