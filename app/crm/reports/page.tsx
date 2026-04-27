"use client";

import { useEffect, useState } from "react";

export default function CRMReportsPage() {
  const [selectedDate, setSelectedDate] = useState("");
  const [reportType, setReportType] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setReportHtml("");
    setError("");
    try {
      const res = await fetch(`/api/crm/reports?type=${reportType}&date=${selectedDate}`);
      if (!res.ok) {
        setError(`خطأ ${res.status}: فشل في تحميل التقرير`);
        return;
      }
      const html = await res.text();
      setReportHtml(html);
    } catch {
      setError("فشل في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 desktop:p-6 space-y-6" dir="rtl">
      <h1 className="text-xl font-black">📋 التقارير</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted block mb-1">نوع التقرير</label>
          <div className="flex gap-2">
            {(["daily", "weekly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReportType(t)}
                className="px-4 py-2 rounded-chip text-sm font-bold transition-colors"
                style={{
                  background: reportType === t ? "rgba(196,16,64,0.15)" : "transparent",
                  color: reportType === t ? "#c41040" : "#71717a",
                  border: `1px solid ${reportType === t ? "#c41040" : "#27272a"}`,
                }}
              >
                {t === "daily" ? "📅 يومي" : "📊 أسبوعي"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted block mb-1">التاريخ</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input"
            style={{ width: 180 }}
          />
        </div>

        <button
          onClick={loadReport}
          disabled={loading || !selectedDate}
          className="btn-primary"
        >
          {loading ? "جاري التحميل..." : "عرض التقرير"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-card p-4 text-center text-red-400">
          ⚠️ {error}
        </div>
      )}

      {reportHtml && (
        <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
          <iframe
            srcDoc={reportHtml}
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ minHeight: 600 }}
            title="تقرير"
          />
        </div>
      )}

      {!reportHtml && !loading && !error && (
        <div className="text-center py-20 text-muted">
          <div className="text-4xl mb-3">📊</div>
          <p>اختر نوع التقرير والتاريخ ثم اضغط &quot;عرض التقرير&quot;</p>
        </div>
      )}
    </div>
  );
}
