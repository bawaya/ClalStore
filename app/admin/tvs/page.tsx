"use client";

export const dynamic = "force-dynamic";

import { CategoryProductAdmin } from "@/components/admin/CategoryProductAdmin";
import { TV_SUBKINDS } from "@/lib/constants";

export default function AdminTvsPage() {
  return (
    <CategoryProductAdmin
      type="tv"
      pageTitle="📺 تلفزيونات (LG / Samsung / Hisense)"
      addLabel="تلفزيون جديد"
      createModalTitle="إضافة تلفزيون"
      editModalTitle="تعديل تلفزيون"
      emptyIcon="📺"
      emptyTitle="لا توجد تلفزيونات"
      emptySub="أضف أول تلفزيون"
      subkindOptions={TV_SUBKINDS}
      subkindLabel="تقنية الشاشة"
      subkindRequired={false}
      defaultSubkind="qled"
      defaultVariantKind="model"
      enableVariants={true}
      enableColors={false}
      specsFields={[
        { key: "screen_size_inch", label: "الحجم (بوصة)", type: "number", placeholder: "65", rowGroup: "row1" },
        { key: "resolution", label: "الدقة", placeholder: "4K UHD / 8K", rowGroup: "row1" },
        { key: "refresh_hz", label: "معدل التحديث (Hz)", type: "number", placeholder: "120", rowGroup: "row2" },
        { key: "hdr", label: "HDR", placeholder: "HDR10+ / Dolby Vision", rowGroup: "row2" },
        { key: "smart_os", label: "نظام التشغيل", placeholder: "WebOS / Tizen / Vidaa" },
        { key: "ports_hdmi", label: "عدد منافذ HDMI", type: "number", placeholder: "4", rowGroup: "row3" },
        { key: "wifi", label: "WiFi", placeholder: "WiFi 6 / 5", rowGroup: "row3" },
      ]}
    />
  );
}
