"use client";

export const dynamic = "force-dynamic";

import { CategoryProductAdmin } from "@/components/admin/CategoryProductAdmin";
import { NETWORK_SUBKINDS } from "@/lib/constants";

export default function AdminNetworkPage() {
  return (
    <CategoryProductAdmin
      type="network"
      pageTitle="📡 شبكة / راوتر (TP-Link و غيرها)"
      addLabel="جهاز شبكة جديد"
      createModalTitle="إضافة جهاز شبكة"
      editModalTitle="تعديل جهاز شبكة"
      emptyIcon="📡"
      emptyTitle="لا توجد أجهزة شبكة"
      emptySub="أضف أول راوتر أو موسّع شبكة"
      subkindOptions={NETWORK_SUBKINDS}
      subkindLabel="فئة الجهاز"
      subkindRequired={false}
      defaultSubkind="router_mesh"
      defaultVariantKind="model"
      enableVariants={true}
      enableColors={false}
      specsFields={[
        { key: "wifi_standard", label: "معيار WiFi", placeholder: "WiFi 6 / WiFi 7", rowGroup: "row1" },
        { key: "units_count", label: "عدد الوحدات", type: "number", placeholder: "2", rowGroup: "row1" },
        { key: "coverage_m2", label: "التغطية (م²)", type: "number", placeholder: "300", rowGroup: "row2" },
        { key: "max_speed_mbps", label: "السرعة القصوى (Mbps)", type: "number", placeholder: "1800", rowGroup: "row2" },
        { key: "lan_ports", label: "منافذ LAN", type: "number", placeholder: "2" },
      ]}
    />
  );
}
