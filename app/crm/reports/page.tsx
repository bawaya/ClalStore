"use client";

import { useState } from "react";

export default function CRMReportsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [reportType, setReportType] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(false);
  const [reportHtml, setReportHtml] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setReportHtml("");
    try {
      const res = await fetch(`/api/crm/reports?type=${reportType}&date=${selectedDate}`);
      const html = await res.text();
      setReportHtml(html);
    } catch {
      setReportHtml("<p style='color:red;text-align:center;padding:40px'>فشل في تحميل التقرير</p>");
    }
    setLoading(false);
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
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "جاري التحميل..." : "عرض التقرير"}
        </button>
      </div>

      {reportHtml && (
        <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
          <iframe
            srcDoc={reportHtml}
            className="w-full border-0"
            style={{ minHeight: 600 }}
            title="تقرير"
          />
        </div>
      )}

      {!reportHtml && !loading && (
        <div className="text-center py-20 text-muted">
          <div className="text-4xl mb-3">📊</div>
          <p>اختر نوع التقرير والتاريخ ثم اضغط "عرض التقرير"</p>
        </div>
      )}
    </div>
  );
}
