"use client";

export const dynamic = "force-dynamic";

import { CategoryProductAdmin } from "@/components/admin/CategoryProductAdmin";
import { COMPUTER_SUBKINDS } from "@/lib/constants";

export default function AdminComputersPage() {
  return (
    <CategoryProductAdmin
      type="computer"
      pageTitle="💻 كمبيوتر / لابتوب / طابعات (Acer / HP / Lenovo)"
      addLabel="جهاز جديد"
      createModalTitle="إضافة جهاز"
      editModalTitle="تعديل جهاز"
      emptyIcon="💻"
      emptyTitle="لا توجد أجهزة"
      emptySub="أضف أول لابتوب أو طابعة"
      subkindOptions={COMPUTER_SUBKINDS}
      subkindLabel="فئة الجهاز"
      subkindRequired={true}
      defaultSubkind="laptop_business"
      defaultVariantKind="model"
      enableVariants={true}
      enableColors={false}
      specsFields={[
        { key: "cpu", label: "المعالج", placeholder: "Intel Core 7 / Ryzen 5", rowGroup: "row1" },
        { key: "ram_gb", label: "RAM (GB)", type: "number", placeholder: "16", rowGroup: "row1" },
        { key: "storage_gb", label: "تخزين (GB)", type: "number", placeholder: "512", rowGroup: "row2" },
        { key: "gpu", label: "كرت الشاشة", placeholder: "RTX 5050 / Intel Graphics", rowGroup: "row2" },
        { key: "screen_size_inch", label: "الشاشة (بوصة)", placeholder: "15.6", rowGroup: "row3" },
        { key: "os", label: "نظام التشغيل", placeholder: "Windows 11 Home", rowGroup: "row3" },
        { key: "battery_hours", label: "البطارية (ساعة)", placeholder: "8", rowGroup: "row4" },
        { key: "weight_kg", label: "الوزن (كغ)", placeholder: "1.8", rowGroup: "row4" },
        { key: "printer_speed_ppm", label: "سرعة الطباعة (PPM)", placeholder: "20" },
      ]}
    />
  );
}
