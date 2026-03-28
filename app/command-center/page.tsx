"use client";

import dynamic from "next/dynamic";
import { CLALMOBILE_CONFIG } from "@/lib/brand-config";

const CommandCenter = dynamic(() => import("@/components/CommandCenter"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A0F] text-[#F6C445] text-lg font-bold">
      ⏳ جاري تحميل مركز القيادة...
    </div>
  ),
});

export default function CommandCenterPage() {
  return <CommandCenter config={CLALMOBILE_CONFIG} />;
}
