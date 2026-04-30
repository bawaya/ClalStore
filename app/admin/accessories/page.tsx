"use client";

export const dynamic = "force-dynamic";

import { CategoryProductAdmin } from "@/components/admin/CategoryProductAdmin";
import { ACCESSORY_SUBKINDS } from "@/lib/constants";

export default function AdminAccessoriesPage() {
  return (
    <CategoryProductAdmin
      type="accessory"
      pageTitle="🔌 الإكسسوارات"
      addLabel="إكسسوار جديد"
      createModalTitle="إضافة إكسسوار"
      editModalTitle="تعديل إكسسوار"
      emptyIcon="🔌"
      emptyTitle="لا توجد إكسسوارات"
      emptySub="أضف أول إكسسوار"
      subkindOptions={ACCESSORY_SUBKINDS}
      subkindLabel="نوع الإكسسوار"
      subkindRequired={false}
      defaultVariantKind="model"
      variantStorageLabel="الطول / السعة / الموديل"
      enableVariants={false}
      enableColors={true}
      specsFields={[
        { key: "compatibility",     label: "التوافق",        placeholder: "iPhone 15 Pro / Galaxy S24",      rowGroup: "row1" },
        { key: "material",          label: "المادة",          placeholder: "سيليكون / جلد / TPU",              rowGroup: "row1" },
        { key: "warranty_months",   label: "الضمان (شهور)",   placeholder: "12",                                rowGroup: "row2", type: "number" },
        { key: "warranty_source",   label: "مصدر الضمان",     placeholder: "وكيل / استيراد / تجاري",           rowGroup: "row2" },
        { key: "length_m",          label: "الطول (متر)",     placeholder: "1.5",                                rowGroup: "row3" },
        { key: "power_w",           label: "القدرة (واط)",    placeholder: "45",                                rowGroup: "row3", type: "number" },
        { key: "capacity_mah",      label: "السعة (mAh)",     placeholder: "10000",                              rowGroup: "row4", type: "number" },
        { key: "connector",         label: "المنفذ",          placeholder: "USB-C / Lightning / 3.5mm",         rowGroup: "row4" },
        { key: "bluetooth_version", label: "بلوتوث",          placeholder: "5.3",                                rowGroup: "row5" },
        { key: "ip_rating",         label: "مقاومة الماء",    placeholder: "IP67 / IPX4",                       rowGroup: "row5" },
      ]}
    />
  );
}
