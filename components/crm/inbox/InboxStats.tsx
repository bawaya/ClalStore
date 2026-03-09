// =====================================================
// ClalMobile — Inbox Stats (Quick Overview)
// =====================================================

"use client";

import type { InboxStats } from "@/lib/crm/inbox-types";

interface Props {
  stats: InboxStats | null;
}

export function InboxStatsBar({ stats }: Props) {
  if (!stats) return null;

  const items = [
    { label: "نشطة", value: stats.active, color: "bg-green-500" },
    { label: "بانتظار", value: stats.waiting, color: "bg-yellow-500" },
    { label: "بوت", value: stats.bot, color: "bg-blue-500" },
    { label: "محلولة اليوم", value: stats.resolved_today, color: "bg-gray-500" },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5 px-3 py-2">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-sm font-bold text-white">{item.value}</span>
          </div>
          <span className="text-[10px] text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
