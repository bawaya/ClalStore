"use client";

import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import type { GeneratorOutput } from "@/lib/intelligence/schemas";

export function GenerateTab() {
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<GeneratorOutput | null>(null);
  const [error, setError] = useState("");

  // Editable copies of the generator output so the user can tweak before save.
  const [editName, setEditName] = useState("");
  const [editAr, setEditAr] = useState("");
  const [editHe, setEditHe] = useState("");

  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [saveMessage, setSaveMessage] = useState("");

  const loadProduct = async () => {
    if (!productId.trim()) {
      setError("ألصق UUID المنتج أولاً");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/admin/intelligence/fix", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "lookup", product_id: productId.trim() }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const p = json.data;
      setName(p.name_ar || p.name_he || p.name_en || "");
      setBrand(p.brand || "");
      setType(p.type || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل المنتج");
    }
  };

  const run = async () => {
    if (!name.trim()) {
      setError("أدخل اسم المنتج");
      return;
    }
    setLoading(true);
    setError("");
    setOutput(null);
    setSaveStatus("");
    try {
      const res = await fetch("/api/admin/intelligence/generate", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          current_name_ar: name,
          current_name_he: name,
          brand: brand || undefined,
          type: type || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const data = json.data as GeneratorOutput;
      setOutput(data);
      setEditName(data.name_en);
      setEditAr(data.description_ar);
      setEditHe(data.description_he);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التوليد");
    }
    setLoading(false);
  };

  const save = async () => {
    if (!productId.trim()) {
      setSaveStatus("error");
      setSaveMessage("أدخل UUID المنتج للحفظ");
      return;
    }
    setSaveStatus("saving");
    setSaveMessage("");
    try {
      const res = await fetch("/api/admin/intelligence/fix", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          action: "save_generated",
          product_id: productId.trim(),
          name_en: editName || undefined,
          description_ar: editAr || undefined,
          description_he: editHe || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSaveStatus("saved");
      setSaveMessage("تم الحفظ على المنتج ✅");
    } catch (err) {
      setSaveStatus("error");
      setSaveMessage(err instanceof Error ? err.message : "فشل الحفظ");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        أدخل اسم منتج (بأي لغة) ويولّد Opus اسماً إنجليزياً نظيفاً ووصفاً عربياً وعبرياً بنبرة متجرك. ألصق UUID المنتج للحفظ المباشر.
      </p>

      <div className="card p-3 space-y-2">
        <div className="text-[11px] text-muted">UUID المنتج (اختياري — للحفظ المباشر)</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 p-2 rounded-lg border border-surface-border bg-transparent text-xs font-mono"
          />
          <button
            type="button"
            onClick={loadProduct}
            disabled={!productId.trim()}
            className="chip whitespace-nowrap disabled:opacity-50"
          >
            📥 جلب
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: שואב אבק אלחוטי Dyson V12 detect slim Absolute"
          className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="البراند (اختياري)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
          />
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="النوع (اختياري)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="chip chip-active w-full justify-center"
        >
          {loading ? "⏳ Opus يكتب..." : "✍️ ولّد المحتوى"}
        </button>
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {output && (
        <div className="space-y-2">
          <div className="card p-3 space-y-1">
            <div className="text-xs text-muted">name_en (الاسم الرسمي)</div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="name_en"
              aria-label="name_en"
              className="w-full p-2 rounded-lg border border-surface-border bg-transparent font-mono font-bold text-sm"
            />
          </div>
          <div className="card p-3 space-y-1">
            <div className="text-xs text-muted">description_ar</div>
            <textarea
              value={editAr}
              onChange={(e) => setEditAr(e.target.value)}
              rows={4}
              placeholder="الوصف بالعربية"
              aria-label="description_ar"
              className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-sm whitespace-pre-wrap"
            />
          </div>
          <div className="card p-3 space-y-1" dir="ltr">
            <div className="text-xs text-muted text-left">description_he</div>
            <textarea
              value={editHe}
              onChange={(e) => setEditHe(e.target.value)}
              rows={4}
              dir="rtl"
              placeholder="התיאור בעברית"
              aria-label="description_he"
              className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-sm whitespace-pre-wrap"
            />
          </div>
          {output.specs_inferred && Object.keys(output.specs_inferred).length > 0 && (
            <div className="card p-3">
              <div className="text-xs text-muted mb-1">specs مستنتجة (للمراجعة فقط)</div>
              <div className="text-xs font-mono">
                {Object.entries(output.specs_inferred).map(([k, v]) => (
                  <div key={k}>
                    {k}: <b>{String(v)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!productId.trim() || saveStatus === "saving"}
              className="py-2 px-4 rounded-lg bg-brand text-white text-sm font-bold cursor-pointer border-0 disabled:opacity-50"
            >
              {saveStatus === "saving" ? "⏳ جاري الحفظ..." : "💾 احفظ على المنتج"}
            </button>
            {saveStatus === "saved" && (
              <span className="text-xs text-state-success">✅ {saveMessage}</span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-state-error">❌ {saveMessage}</span>
            )}
            {!productId.trim() && (
              <span className="text-[10px] text-muted">
                (ألصق UUID فوق لتفعيل الحفظ)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
