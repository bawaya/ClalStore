"use client";

export const dynamic = "force-dynamic";

import { CategoryProductAdmin } from "@/components/admin/CategoryProductAdmin";
import { TABLET_SUBKINDS } from "@/lib/constants";

export default function AdminTabletsPage() {
  return (
    <CategoryProductAdmin
      type="tablet"
      pageTitle="📱 تابلت (iPad / FunPad / أندرويد)"
      addLabel="تابلت جديد"
      createModalTitle="إضافة تابلت"
      editModalTitle="تعديل تابلت"
      emptyIcon="📱"
      emptyTitle="لا توجد تابلتات"
      emptySub="أضف أول جهاز تابلت"
      subkindOptions={TABLET_SUBKINDS}
      subkindLabel="فئة التابلت"
      subkindRequired={false}
      defaultSubkind="apple_air"
      defaultVariantKind="storage"
      variantStorageLabel="السعة (مثل الموبايل)"
      enableVariants={true}
      enableColors={true}
      specsFields={[
        { key: "screen_size_inch", label: "حجم الشاشة (بوصة)", placeholder: "11", rowGroup: "row1" },
        { key: "chip", label: "المعالج", placeholder: "M3 / M2 / A14", rowGroup: "row1" },
        { key: "cellular", label: "خلوي", placeholder: "WiFi / WiFi+Cellular", rowGroup: "row2" },
        { key: "year", label: "السنة", placeholder: "2025", rowGroup: "row2" },
        { key: "pencil_support", label: "دعم القلم", placeholder: "Apple Pencil 2 / USB-C", rowGroup: "row3" },
        { key: "front_camera", label: "كاميرا أمامية", placeholder: "12MP", rowGroup: "row3" },
      ]}
    />
  );
}
