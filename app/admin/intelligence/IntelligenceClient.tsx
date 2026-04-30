"use client";

import { useState } from "react";
import { ClassifyTab } from "./ClassifyTab";
import { HealthTab } from "./HealthTab";
import { GenerateTab } from "./GenerateTab";
import { ChatTab } from "./ChatTab";
import { ImagesTab } from "./ImagesTab";
import { PageHeader } from "@/components/admin/shared";

type Tab = "classify" | "health" | "generate" | "chat" | "images";

const TABS: { key: Tab; label: string; icon: string; sub: string }[] = [
  { key: "classify", label: "تصنيف", icon: "🎯", sub: "اقتراحات Opus لإصلاح المنتجات" },
  { key: "health",   label: "صحة الكتالوج", icon: "🩺", sub: "تكرارات، شذوذ، حقول ناقصة" },
  { key: "generate", label: "توليد محتوى", icon: "✍️", sub: "أوصاف عربي/عبري + اسم EN" },
  { key: "chat",     label: "اسأل الكتالوج", icon: "💬", sub: "محادثة طبيعية مع كتالوجك" },
  { key: "images",   label: "صور المنتجات", icon: "🖼️", sub: "بحث + تصفية + فحص بالرؤية" },
];

export function IntelligenceClient() {
  const [tab, setTab] = useState<Tab>("classify");

  return (
    <div>
      <PageHeader title="🧠 الذكاء الكتالوجي" />
      <p className="text-xs text-muted mb-3">
        مدعوم بـ Claude Opus 4.7 (1M context). يقرأ الكتالوج كاملاً ويولّد قرارات قابلة للمراجعة قبل التطبيق.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`card text-right p-3 cursor-pointer transition-all ${
              tab === t.key ? "border-brand bg-brand/5" : "hover:border-brand/40"
            }`}
          >
            <div className="text-xl mb-1">{t.icon}</div>
            <div className="font-bold text-sm">{t.label}</div>
            <div className="text-[10px] text-muted">{t.sub}</div>
          </button>
        ))}
      </div>

      <div className="card p-4">
        {tab === "classify" && <ClassifyTab />}
        {tab === "health" && <HealthTab />}
        {tab === "generate" && <GenerateTab />}
        {tab === "chat" && <ChatTab />}
        {tab === "images" && <ImagesTab />}
      </div>
    </div>
  );
}
