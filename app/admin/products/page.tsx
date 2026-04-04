"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, ConfirmDialog, ErrorBanner, ToastContainer } from "@/components/admin/shared";
import { aiEnhanceProduct, translateProductName, detectProductType, findDuplicates } from "@/lib/admin/ai-tools";
import type { Product, ProductColor, ProductVariant } from "@/types/database";
import { csrfHeaders } from "@/lib/csrf-client";

import { ProductFilters } from "./ProductFilters";
import { ProductTable } from "./ProductTable";
import { ProductForm } from "./ProductForm";

const EMPTY: Partial<Product> = {
  type: "device", brand: "", name_ar: "", name_en: "", name_he: "", price: 0, old_price: undefined,
  cost: 0, stock: 0, description_ar: "", colors: [], storage_options: [], variants: [], specs: {},
  active: true, featured: false,
};

export default function ProductsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const { data: products, loading, error, clearError, create, update, remove, bulkRemove, pagination, setPage } = useAdminApi<Product>({ endpoint: "/api/admin/products" });

  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Product>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [enhancingImage, setEnhancingImage] = useState(false);
  const [enhanceMenu, setEnhanceMenu] = useState(false);
  const [enhanceLabel, setEnhanceLabel] = useState("");
  const [uploadingColor, setUploadingColor] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; confidence: string }[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [suggestedColorImages, setSuggestedColorImages] = useState<Record<number, string>>({});
  const [stockMode, setStockMode] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [payngoOpen, setPayngoOpen] = useState(false);
  const [payngoQuery, setPayngoQuery] = useState("");
  const [payngoResults, setPayngoResults] = useState<{ name: string; image_url: string }[]>([]);
  const [payngoLoading, setPayngoLoading] = useState(false);
  const [payngoColorLoading, setPayngoColorLoading] = useState<number | null>(null);
  const [gsmaColorLoading, setGsmaColorLoading] = useState<number | null>(null);
  const [pexelsOpen, setPexelsOpen] = useState<number | null>(null);
  const [pexelsResults, setPexelsResults] = useState<{ id: number; alt: string; src: string; thumb: string }[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [bulkColorLoading, setBulkColorLoading] = useState(false);

  // === Image Upload (single file) ===
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) return data.url;
      show(`❌ ${data.error}`, "error");
      return null;
    } catch {
      show("❌ فشل رفع الصورة", "error");
      return null;
    }
  };

  const handleMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) { setForm(prev => ({ ...prev, image_url: url })); show("✅ تم رفع الصورة"); }
    setUploading(false);
    e.target.value = "";
  };

  // Resize + compress image using Canvas (client-side)
  const resizeAndCompress = (imageUrl: string, maxW = 800, maxH = 800, quality = 0.85): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("فشل ضغط الصورة"));
            resolve(new File([blob], `optimized-${Date.now()}.webp`, { type: "image/webp" }));
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("فشل تحميل الصورة"));
      img.src = imageUrl;
    });
  };

  const handleEnhanceImage = async (mode: "removebg" | "optimize" | "both") => {
    if (enhancingImage) return;
    setEnhancingImage(true);
    setEnhanceMenu(false);

    // Collect all images: main + gallery + color images
    const allImages: { type: "main" | "gallery" | "color"; index: number; url: string }[] = [];
    if (form.image_url) allImages.push({ type: "main", index: 0, url: form.image_url });
    (form.gallery || []).forEach((url, i) => { if (url) allImages.push({ type: "gallery", index: i, url }); });
    (form.colors || []).forEach((c, i) => { if (c.image) allImages.push({ type: "color", index: i, url: c.image }); });

    if (allImages.length === 0) {
      show("❌ لا توجد صور لتحسينها", "error");
      setEnhancingImage(false);
      return;
    }

    // Process each image
    const enhanceSingle = async (url: string, label: string): Promise<string | null> => {
      let currentUrl = url;
      try {
        // Step 1: Remove background
        if (mode === "removebg" || mode === "both") {
          const res = await fetch("/api/admin/image-enhance", {
            method: "POST",
            headers: csrfHeaders(),
            body: JSON.stringify({ image_url: currentUrl }),
          });
          const data = await res.json();
          if (data.success && data.url) {
            currentUrl = data.url;
          } else {
            console.error(`[Enhance] ${label} failed:`, data.error, data.step);
            show(`❌ ${label}: ${data.error || "فشل غير معروف"}`, "error");
            return null;
          }
        }
        // Step 2: Resize + compress
        if (mode === "optimize" || mode === "both") {
          const optimizedFile = await resizeAndCompress(currentUrl, 800, 800, 0.85);
          const uploaded = await uploadImage(optimizedFile);
          if (uploaded) {
            currentUrl = uploaded;
          } else {
            return null;
          }
        }
        return currentUrl;
      } catch (err: unknown) {
        console.error(`[Enhance] ${label} error:`, err);
        show(`❌ ${label}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
        return null;
      }
    };

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < allImages.length; i++) {
      const item = allImages[i];
      const label = item.type === "main" ? "الصورة الرئيسية"
        : item.type === "gallery" ? `صورة المعرض ${item.index + 1}`
        : `صورة اللون ${(form.colors || [])[item.index]?.name_ar || item.index + 1}`;
      setEnhanceLabel(`${label} (${i + 1}/${allImages.length})...`);

      const result = await enhanceSingle(item.url, label);
      if (result) {
        successCount++;
        // Update the correct image in form
        if (item.type === "main") {
          setForm((prev) => ({ ...prev, image_url: result }));
        } else if (item.type === "gallery") {
          setForm((prev) => {
            const gallery = [...(prev.gallery || [])];
            gallery[item.index] = result;
            return { ...prev, gallery };
          });
        } else if (item.type === "color") {
          setForm((prev) => {
            const colors = [...(prev.colors || [])];
            colors[item.index] = { ...colors[item.index], image: result };
            return { ...prev, colors };
          });
        }
      } else {
        failCount++;
      }
    }

    const modeLabel = mode === "removebg" ? "إزالة الخلفية"
      : mode === "optimize" ? "تحسين الحجم والجودة"
      : "إزالة الخلفية + تحسين";
    if (failCount === 0) {
      show(`✅ تم ${modeLabel} لـ ${successCount} صورة بنجاح!`);
    } else {
      show(`⚠️ ${modeLabel}: ${successCount} نجحت، ${failCount} فشلت`, failCount === allImages.length ? "error" : "success");
    }

    setEnhancingImage(false);
    setEnhanceLabel("");
  };

  const handleGalleryImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i]);
      if (url) newUrls.push(url);
    }
    if (newUrls.length) {
      setForm((prev) => ({ ...prev, gallery: [...(prev.gallery || []), ...newUrls] }));
      show(`✅ تم رفع ${newUrls.length} صورة`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeGalleryImage = (idx: number) => {
    setForm(prev => ({ ...prev, gallery: (prev.gallery || []).filter((_, i) => i !== idx) }));
  };

  // === Color Management ===
  const addColor = () => {
    setForm(prev => ({ ...prev, colors: [...(prev.colors || []), { hex: "#000000", name_ar: "", name_he: "", image: undefined }] }));
  };

  const updateColor = (idx: number, field: keyof ProductColor, value: string) => {
    setForm(prev => {
      const updated = [...(prev.colors || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, colors: updated };
    });
  };

  const removeColor = (idx: number) => {
    setForm(prev => ({ ...prev, colors: (prev.colors || []).filter((_, i) => i !== idx) }));
  };

  const handleColorImage = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingColor(idx);
    const url = await uploadImage(file);
    if (url) {
      setForm(prev => {
        const updated = [...(prev.colors || [])];
        updated[idx] = { ...updated[idx], image: url };
        return { ...prev, colors: updated };
      });
      show("✅ تم رفع صورة اللون");
    }
    setUploadingColor(null);
    e.target.value = "";
  };

  // === Auto-Fill (MobileAPI / GSMArena) ===
  const handleAutoFill = async (provider: "mobileapi" | "gsmarena" | "combined") => {
    setShowProviderPicker(false);
    if (!form.brand || (!form.name_ar && !nameEn)) {
      show("❌ أدخل اسم المنتج والشركة أولاً", "error");
      return;
    }
    setAutoFilling(true);
    try {
      const searchName = nameEn || form.name_ar;
      const res = await fetch("/api/admin/products/autofill", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ name: searchName, brand: form.brand, provider }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const d = json.data;
      setForm((prev) => ({
        ...prev,
        description_ar: d.description_ar || prev.description_ar,
        description_he: d.description_he || prev.description_he,
        specs: d.specs && Object.keys(d.specs).some((k: string) => d.specs[k]) ? d.specs : prev.specs,
        colors: d.colors?.length ? d.colors.map((c: any) => ({ hex: c.hex, name_ar: c.name_ar, name_he: c.name_he, image: c.image || undefined })) : prev.colors,
        storage_options: d.storage_options?.length ? d.storage_options : prev.storage_options,
        variants: d.storage_options?.length
          ? d.storage_options.map((s: string) => ({
              storage: s,
              price: prev.price || 0,
              old_price: undefined,
              cost: prev.cost || 0,
              stock: 0,
            }))
          : prev.variants,
        image_url: d.image_url || prev.image_url,
        gallery: d.gallery?.length ? [...new Set([...(prev.gallery || []), ...d.gallery])] : prev.gallery,
      }));
      // Track suggested color images for "use suggested" buttons
      if (d.colors?.length) {
        const suggested: Record<number, string> = {};
        d.colors.forEach((c: any, i: number) => { if (c.image) suggested[i] = c.image; });
        setSuggestedColorImages(suggested);
      }
      const colorImgCount = d.colors?.filter((c: any) => c.image).length || 0;
      show(`✅ تم جلب بيانات ${d.phone_name || form.name_ar} — ${d.colors?.length || 0} ألوان${colorImgCount ? ` (${colorImgCount} بصور)` : ""}، ${d.storage_options?.length || 0} سعات`);
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setAutoFilling(false);
  };

  // === Variant Management ===
  const addVariant = () => {
    setForm(prev => ({ ...prev, variants: [...(prev.variants || []), { storage: "", price: 0, old_price: undefined, cost: 0, stock: 10 }] }));
  };

  const updateVariant = (idx: number, field: keyof ProductVariant, value: string | number | undefined) => {
    setForm(prev => {
      const updated = [...(prev.variants || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const removeVariant = (idx: number) => {
    setForm(prev => ({ ...prev, variants: (prev.variants || []).filter((_, i) => i !== idx) }));
  };

  const adminBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort(),
    [products]
  );

  const filtered = useMemo(() => {
    let list = products;
    if (filter === "device") list = list.filter((p) => p.type === "device");
    else if (filter === "accessory") list = list.filter((p) => p.type === "accessory");
    else if (filter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    else if (filter === "out") list = list.filter((p) => p.stock === 0);
    if (brandFilter !== "all") list = list.filter((p) => p.brand === brandFilter);
    return list;
  }, [products, filter, brandFilter]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setNameEn(""); setDuplicateWarning([]); setModal(true); };
  const openEdit = (p: Product) => { setForm({ ...p }); setEditId(p.id); setNameEn(p.name_en || ""); setDuplicateWarning([]); setModal(true); };

  // === AI: Handle English name change ===
  const handleNameEnChange = (value: string) => {
    setNameEn(value);
    if (!value.trim()) {
      setDuplicateWarning([]);
      return;
    }
    const { name_ar, name_he } = translateProductName(value);
    setForm((prev) => ({ ...prev, name_ar, name_he }));
    const detectedType = detectProductType(value);
    setForm((prev) => ({ ...prev, type: detectedType }));
    const dups = findDuplicates(value, form.brand || "", products, editId);
    setDuplicateWarning(dups.map((d) => ({ name: d.product.name_ar, confidence: d.confidence })));
  };

  const handleSave = async () => {
    try {
      if (!form.name_ar || !form.brand || !form.price) {
        show("❌ عبّي الحقول المطلوبة", "error"); return;
      }

      setAiProcessing(true);
      const saveForm = { ...form, name_en: nameEn.trim() || undefined };

      if (nameEn.trim()) {
        try {
          const aiRes = await fetch("/api/admin/ai-enhance", {
            method: "POST",
            headers: csrfHeaders(),
            body: JSON.stringify({ name_en: nameEn, brand: form.brand || "", specs: form.specs || {}, type: form.type || "device" }),
          });
          if (aiRes.ok) {
            const { data: ai } = await aiRes.json();
            if (ai.name_ar) saveForm.name_ar = ai.name_ar;
            if (ai.name_he) saveForm.name_he = ai.name_he;
            if (ai.type) saveForm.type = ai.type;
            if (!form.description_ar?.trim() && ai.description_ar) saveForm.description_ar = ai.description_ar;
            if (!form.description_he?.trim() && ai.description_he) saveForm.description_he = ai.description_he;
          } else {
            const ai = aiEnhanceProduct(nameEn, form.brand || "", form.specs || {}, products, editId);
            saveForm.name_ar = ai.name_ar;
            saveForm.name_he = ai.name_he;
            if (!form.description_ar?.trim()) saveForm.description_ar = ai.description_ar;
            if (!form.description_he?.trim()) saveForm.description_he = ai.description_he;
            saveForm.type = ai.type;
          }
        } catch {
          const ai = aiEnhanceProduct(nameEn, form.brand || "", form.specs || {}, products, editId);
          saveForm.name_ar = ai.name_ar;
          saveForm.name_he = ai.name_he;
          if (!form.description_ar?.trim()) saveForm.description_ar = ai.description_ar;
          if (!form.description_he?.trim()) saveForm.description_he = ai.description_he;
          saveForm.type = ai.type;
        }
      }

      const variants = saveForm.variants || [];
      if (variants.length > 0) {
        saveForm.storage_options = variants.map((v) => v.storage).filter(Boolean);
        const minPrice = Math.min(...variants.map((v) => v.price).filter((p) => p > 0));
        if (minPrice > 0 && minPrice < Infinity) saveForm.price = minPrice;
      }

      if (editId) {
        await update(editId, saveForm);
        show("✅ تم التعديل");
      } else {
        await create(saveForm);
        show("✅ تم الإضافة");
      }
      setAiProcessing(false);
      setModal(false);
    } catch (err: unknown) {
      setAiProcessing(false);
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await remove(confirm);
      show("🗑️ تم الحذف");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setConfirm(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const deleted = await bulkRemove(Array.from(selected));
      show(`🗑️ تم حذف ${deleted} منتج`);
      setSelected(new Set());
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setBulkDeleting(false);
    setBulkConfirm(false);
  };

  const searchPaynGo = async () => {
    if (!payngoQuery.trim()) return;
    setPayngoLoading(true);
    setPayngoResults([]);
    try {
      const res = await fetch("/api/admin/products/import-image", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ query: payngoQuery.trim() }),
      });
      const data = await res.json();
      if (data.results) {
        setPayngoResults(data.results);
        if (data.results.length === 0) show("لم يتم العثور على نتائج", "error");
      } else {
        show(`❌ ${data.error}`, "error");
      }
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setPayngoLoading(false);
  };

  const selectPaynGoImage = (imageUrl: string) => {
    setForm(prev => ({ ...prev, image_url: imageUrl }));
    setPayngoOpen(false);
    setPayngoResults([]);
    setPayngoQuery("");
    show("✅ تم استيراد الصورة من PaynGo");
  };

  // Arabic-to-Hebrew color mapping for PaynGo search
  const colorToHebrew: Record<string, string> = {
    "أسود": "שחור", "أبيض": "לבן", "أحمر": "אדום", "أزرق": "כחול",
    "أخضر": "ירוק", "وردي": "ורוד", "رمادي": "אפור", "بنفسجي": "סגול",
    "ذهبي": "זהב", "فضي": "כסף", "برتقالي": "כתום", "بيج": "בז'",
    "تيتانيوم": "טיטניום", "كريمي": "קרם", "سماوي": "כחול",
    "تيتانيوم أسود": "שחור טיטניום", "تيتانيوم طبيعي": "טיטניום טבעי",
    "تيتانيوم أبيض": "לבן טיטניום", "تيتانيوم صحراوي": "טיטניום מדברי",
  };

  const importPaynGoColorImage = async (colorIndex: number) => {
    const productName = form.name_en || form.name_ar || "";
    if (!productName) { show("أدخل اسم المنتج أولاً", "error"); return; }
    const color = (form.colors || [])[colorIndex];
    if (!color) return;
    const colorHe = color.name_he?.trim() || colorToHebrew[color.name_ar?.trim()] || "";
    const colorLabel = color.name_ar || colorHe;
    setPayngoColorLoading(colorIndex);
    try {
      const res = await fetch("/api/admin/products/import-image", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ query: productName, color_he: colorHe }),
      });
      const data = await res.json();
      if (data.results?.length > 0) {
        const imgUrl = data.results[0].image_url;
        setForm(prev => {
          const updated = [...(prev.colors || [])];
          updated[colorIndex] = { ...updated[colorIndex], image: imgUrl };
          return { ...prev, colors: updated };
        });
        show(`✅ تم استيراد صورة اللون: ${colorLabel}`);
      } else {
        show("لم يتم العثور على صورة لهذا اللون في PaynGo", "error");
      }
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setPayngoColorLoading(null);
  };

  // Import color image from GSMArena gallery
  const importGsmaColorImage = async (colorIndex: number) => {
    const productName = form.name_en || nameEn || form.name_ar || "";
    if (!productName || !form.brand) { show("أدخل اسم المنتج والشركة أولاً", "error"); return; }
    const color = (form.colors || [])[colorIndex];
    if (!color) return;
    setGsmaColorLoading(colorIndex);
    try {
      const res = await fetch("/api/admin/products/color-image", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ name: productName, brand: form.brand }),
      });
      const data = await res.json();

      if (data.error && !data.colors?.length) {
        show(`❌ ${data.error}`, "error");
        setGsmaColorLoading(null);
        return;
      }

      const allColors = data.colors || [];
      if (allColors.length === 0) {
        show("لم يتم العثور على صور ألوان في GSMArena", "error");
        setGsmaColorLoading(null);
        return;
      }

      const colorAr = color.name_ar?.trim() || "";

      const arToEn: Record<string, string[]> = {};
      for (const [en, info] of Object.entries({
        "black": "أسود", "white": "أبيض", "red": "أحمر", "blue": "أزرق",
        "green": "أخضر", "pink": "وردي", "gray": "رمادي", "purple": "بنفسجي",
        "gold": "ذهبي", "silver": "فضي", "orange": "برتقالي",
        "titanium": "تيتانيوم", "natural titanium": "تيتانيوم طبيعي",
        "black titanium": "تيتانيوم أسود", "white titanium": "تيتانيوم أبيض",
        "desert titanium": "تيتانيوم صحراوي", "blue titanium": "تيتانيوم أزرق",
      })) {
        if (!arToEn[info]) arToEn[info] = [];
        arToEn[info].push(en);
      }

      const enCandidates = arToEn[colorAr] || [];
      let matched = allColors.find((c: any) =>
        enCandidates.some(en => c.name_en.toLowerCase().includes(en))
      );

      if (!matched && colorIndex < allColors.length) {
        matched = allColors[colorIndex];
      }

      if (matched) {
        setForm(prev => {
          const updated = [...(prev.colors || [])];
          updated[colorIndex] = { ...updated[colorIndex], image: matched.image_url };
          return { ...prev, colors: updated };
        });
        show(`✅ تم استيراد صورة (${matched.name_en}) من GSMArena`);
      } else {
        setForm(prev => {
          const updated = [...(prev.colors || [])];
          updated[colorIndex] = { ...updated[colorIndex], image: allColors[0].image_url };
          return { ...prev, colors: updated };
        });
        show(`✅ تم استيراد صورة (${allColors[0].name_en}) من GSMArena`);
      }
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setGsmaColorLoading(null);
  };

  // Open Pexels search for a color
  const openPexelsForColor = async (colorIndex: number) => {
    const productName = form.name_en || nameEn || form.name_ar || "";
    if (!productName) { show("أدخل اسم المنتج أولاً", "error"); return; }
    const color = (form.colors || [])[colorIndex];
    if (!color) return;
    const arToEn: Record<string, string> = {
      "أسود": "black", "أبيض": "white", "أحمر": "red", "أزرق": "blue",
      "أخضر": "green", "وردي": "pink", "رمادي": "gray", "بنفسجي": "purple",
      "ذهبي": "gold", "فضي": "silver", "برتقالي": "orange", "بيج": "beige",
      "تيتانيوم": "titanium", "تيتانيوم أسود": "black titanium",
      "تيتانيوم طبيعي": "natural titanium", "تيتانيوم أبيض": "white titanium",
      "تيتانيوم صحراوي": "desert titanium",
    };
    const colorEn = arToEn[color.name_ar?.trim()] || color.name_ar || "";
    const query = `${form.brand || ""} ${productName} ${colorEn} smartphone`.trim();
    setPexelsOpen(colorIndex);
    setPexelsResults([]);
    setPexelsLoading(true);
    try {
      const res = await fetch("/api/admin/products/pexels", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ query, per_page: 12 }),
      });
      const data = await res.json();
      setPexelsResults(data.photos || []);
      if (!data.photos?.length) show("لم يتم العثور على نتائج في Pexels", "error");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setPexelsLoading(false);
  };

  const selectPexelsImage = (colorIndex: number, imageUrl: string) => {
    setForm(prev => {
      const updated = [...(prev.colors || [])];
      updated[colorIndex] = { ...updated[colorIndex], image: imageUrl };
      return { ...prev, colors: updated };
    });
    setPexelsOpen(null);
    setPexelsResults([]);
    show("✅ تم اختيار الصورة من Pexels");
  };

  // Bulk fetch all color images
  const fetchAllColorImages = async () => {
    const productName = form.name_en || nameEn || form.name_ar || "";
    if (!productName || !form.brand) { show("أدخل اسم المنتج والشركة أولاً", "error"); return; }
    const colors = form.colors || [];
    if (colors.length === 0) { show("لم تتم إضافة ألوان", "error"); return; }

    const colorsWithoutImages = colors.filter(c => !c.image);
    if (colorsWithoutImages.length === 0) { show("جميع الألوان لديها صور بالفعل ✅"); return; }

    setBulkColorLoading(true);
    try {
      const res = await fetch("/api/admin/products/bulk-color-images", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          name: productName,
          brand: form.brand,
          colors: colors.map(c => ({
            name_ar: c.name_ar,
            name_he: c.name_he,
            has_image: !!c.image,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) { show(`❌ ${data.error}`, "error"); setBulkColorLoading(false); return; }

      const results = data.results || [];
      const succeeded = results.filter((r: any) => r.image_url);
      const failed = results.filter((r: any) => !r.image_url);

      if (succeeded.length > 0) {
        setForm(prev => {
          const updated = [...(prev.colors || [])];
          for (const r of succeeded) {
            if (updated[r.index]) {
              updated[r.index] = { ...updated[r.index], image: r.image_url };
            }
          }
          return { ...prev, colors: updated };
        });
      }

      const sources = succeeded.map((r: any) => r.source);
      const payngoCount = sources.filter((s: string) => s === "payngo").length;
      const gsmaCount = sources.filter((s: string) => s === "gsmarena").length;

      let msg = `✅ تم جلب ${succeeded.length} من ${results.length} صور`;
      if (payngoCount) msg += ` (PaynGo: ${payngoCount})`;
      if (gsmaCount) msg += ` (GSMArena: ${gsmaCount})`;
      if (failed.length > 0) msg += ` | ❌ ${failed.length} فشل: ${failed.map((r: any) => r.color_name).join("، ")}`;

      show(msg, failed.length > 0 && succeeded.length === 0 ? "error" : "success");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setBulkColorLoading(false);
  };

  const distributeStock = async (mode: string) => {
    setDistributing(true);
    try {
      const res = await fetch("/api/admin/products/distribute-stock", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.success) {
        show(`✅ تم توزيع المخزون على ${data.updated} منتج`, "success");
        setStockMode(false);
        window.location.reload();
      } else {
        show(`❌ ${data.error}`, "error");
      }
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setDistributing(false);
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="📱 المنتجات" count={products.length} onAdd={openCreate} addLabel="منتج جديد" />
      <ErrorBanner error={error} onDismiss={clearError} />

      <ProductFilters
        stockMode={stockMode}
        setStockMode={setStockMode}
        distributing={distributing}
        distributeStock={distributeStock}
        filter={filter}
        setFilter={setFilter}
        brandFilter={brandFilter}
        setBrandFilter={setBrandFilter}
        adminBrands={adminBrands}
        selected={selected}
        setSelected={setSelected}
        setBulkConfirm={setBulkConfirm}
        bulkDeleting={bulkDeleting}
        filteredCount={filtered.length}
      />

      <ProductTable
        filtered={filtered}
        selected={selected}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        openEdit={openEdit}
        setConfirm={setConfirm}
        update={update}
        show={show}
        pagination={pagination}
        setPage={setPage}
      />

      <ProductForm
        modal={modal}
        setModal={setModal}
        editId={editId}
        form={form}
        setForm={setForm}
        nameEn={nameEn}
        handleNameEnChange={handleNameEnChange}
        duplicateWarning={duplicateWarning}
        handleSave={handleSave}
        aiProcessing={aiProcessing}
        uploading={uploading}
        handleMainImage={handleMainImage}
        handleGalleryImages={handleGalleryImages}
        removeGalleryImage={removeGalleryImage}
        enhancingImage={enhancingImage}
        enhanceMenu={enhanceMenu}
        setEnhanceMenu={setEnhanceMenu}
        enhanceLabel={enhanceLabel}
        handleEnhanceImage={handleEnhanceImage}
        zoomImage={zoomImage}
        setZoomImage={setZoomImage}
        addColor={addColor}
        updateColor={updateColor}
        removeColor={removeColor}
        handleColorImage={handleColorImage}
        uploadingColor={uploadingColor}
        suggestedColorImages={suggestedColorImages}
        importPaynGoColorImage={importPaynGoColorImage}
        payngoColorLoading={payngoColorLoading}
        importGsmaColorImage={importGsmaColorImage}
        gsmaColorLoading={gsmaColorLoading}
        openPexelsForColor={openPexelsForColor}
        pexelsOpen={pexelsOpen}
        pexelsResults={pexelsResults}
        pexelsLoading={pexelsLoading}
        selectPexelsImage={selectPexelsImage}
        setPexelsOpen={setPexelsOpen}
        setPexelsResults={setPexelsResults}
        fetchAllColorImages={fetchAllColorImages}
        bulkColorLoading={bulkColorLoading}
        addVariant={addVariant}
        updateVariant={updateVariant}
        removeVariant={removeVariant}
        autoFilling={autoFilling}
        showProviderPicker={showProviderPicker}
        setShowProviderPicker={setShowProviderPicker}
        handleAutoFill={handleAutoFill}
        payngoOpen={payngoOpen}
        setPayngoOpen={setPayngoOpen}
        payngoQuery={payngoQuery}
        setPayngoQuery={setPayngoQuery}
        payngoResults={payngoResults}
        payngoLoading={payngoLoading}
        searchPaynGo={searchPaynGo}
        selectPaynGoImage={selectPaynGoImage}
        show={show}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="حذف المنتج؟" message="هل أنت متأكد؟ هذا الإجراء لا يمكن التراجع عنه."
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkConfirm} onClose={() => setBulkConfirm(false)} onConfirm={handleBulkDelete}
        title={`حذف ${selected.size} منتج؟`}
        message={`سيتم حذف ${selected.size} منتج نهائياً. هذا الإجراء لا يمكن التراجع عنه.`}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}
