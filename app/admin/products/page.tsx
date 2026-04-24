"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef, useMemo } from "react";
import Image from "next/image";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState, ErrorBanner, ToastContainer } from "@/components/admin/shared";
import { IMAGE_DIMS } from "@/components/admin/ImageUpload";
import { PRODUCT_TYPES } from "@/lib/constants";
import { calcMargin } from "@/lib/utils";
import { aiEnhanceProduct, translateProductName, detectProductType, findDuplicates } from "@/lib/admin/ai-tools";
import type { Product, ProductColor, ProductVariant } from "@/types/database";
import { csrfHeaders } from "@/lib/csrf-client";

const EMPTY: Partial<Product> = {
  type: "device", brand: "", name_ar: "", name_en: "", name_he: "", price: 0, old_price: undefined,
  cost: 0, stock: 0, description_ar: "", colors: [], storage_options: [], variants: [], specs: {},
  active: true, featured: false,
};

export default function ProductsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  // Mobile admin: only devices + accessories. Appliances have their own /admin/appliances page.
  const { data: products, loading, error, clearError, create, update, remove, bulkRemove, pagination, setPage } = useAdminApi<Product>({ endpoint: "/api/admin/products?types=device,accessory", paginate: { limit: 20 } });

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const colorInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [uploadingColor, setUploadingColor] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; confidence: string }[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [suggestedColorImages, setSuggestedColorImages] = useState<Record<number, string>>({}); // index → url from auto-fill
  const [stockMode, setStockMode] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [payngoOpen, setPayngoOpen] = useState(false);
  const [payngoQuery, setPayngoQuery] = useState("");
  const [payngoResults, setPayngoResults] = useState<{ name: string; image_url: string }[]>([]);
  const [payngoLoading, setPayngoLoading] = useState(false);
  const [payngoColorLoading, setPayngoColorLoading] = useState<number | null>(null);
  const [gsmaColorLoading, setGsmaColorLoading] = useState<number | null>(null);
  const [pexelsOpen, setPexelsOpen] = useState<number | null>(null); // colorIndex or null
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
      const img = new (window as any).Image() as HTMLImageElement;
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

  // Sync storage_options from variants
  const _syncStorageFromVariants = () => {
    const variants = form.variants || [];
    if (variants.length > 0) {
      const storageLabels = variants.map((v) => v.storage).filter(Boolean);
      setForm((prev) => ({ ...prev, storage_options: storageLabels }));
    }
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

  // === AI: Handle English name change → live translate + detect type + check duplicates ===
  const handleNameEnChange = (value: string) => {
    setNameEn(value);
    if (!value.trim()) {
      setDuplicateWarning([]);
      return;
    }
    // Live translate name
    const { name_ar, name_he } = translateProductName(value);
    setForm((prev) => ({ ...prev, name_ar, name_he }));
    // Auto-detect type
    const detectedType = detectProductType(value);
    setForm((prev) => ({ ...prev, type: detectedType }));
    // Check duplicates
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

      // AI Enhancement: If English name provided, call OpenAI for professional translation
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
            // Only override descriptions if user hasn't manually written them
            if (!form.description_ar?.trim() && ai.description_ar) saveForm.description_ar = ai.description_ar;
            if (!form.description_he?.trim() && ai.description_he) saveForm.description_he = ai.description_he;
          } else {
            // Fallback to local dictionary if OpenAI fails
            const ai = aiEnhanceProduct(nameEn, form.brand || "", form.specs || {}, products, editId);
            saveForm.name_ar = ai.name_ar;
            saveForm.name_he = ai.name_he;
            if (!form.description_ar?.trim()) saveForm.description_ar = ai.description_ar;
            if (!form.description_he?.trim()) saveForm.description_he = ai.description_he;
            saveForm.type = ai.type;
          }
        } catch {
          // Fallback to local dictionary on network error
          const ai = aiEnhanceProduct(nameEn, form.brand || "", form.specs || {}, products, editId);
          saveForm.name_ar = ai.name_ar;
          saveForm.name_he = ai.name_he;
          if (!form.description_ar?.trim()) saveForm.description_ar = ai.description_ar;
          if (!form.description_he?.trim()) saveForm.description_he = ai.description_he;
          saveForm.type = ai.type;
        }
      }

      // Auto-sync storage_options from variants
      const variants = saveForm.variants || [];
      if (variants.length > 0) {
        saveForm.storage_options = variants.map((v) => v.storage).filter(Boolean);
        // Set base price to minimum variant price
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

  // Arabic-to-Hebrew color mapping for PaynGo search (PaynGo uses Hebrew names like "צבע שחור")
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
    // Get Hebrew color name for PaynGo search
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
      // First try: fetch all GSMArena color images for this product
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

      // Match by Arabic→English: find matching color by name
      const colorAr = color.name_ar?.trim() || "";
      const _colorHe = color.name_he?.trim() || "";

      // Build reverse map (Arabic → possible English names)
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

      // Find matching GSMArena color
      const enCandidates = arToEn[colorAr] || [];
      let matched = allColors.find((c: any) =>
        enCandidates.some(en => c.name_en.toLowerCase().includes(en))
      );

      // Fallback: try positional match (same index)
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
        // Use first available
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
    // Map Arabic color to English for Pexels search
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

  // Bulk fetch all color images (PaynGo → GSMArena → skip)
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

  const margin = form.price && form.cost ? calcMargin(Number(form.price), Number(form.cost)) : 0;
  const profit = (Number(form.price) || 0) - (Number(form.cost) || 0);

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="📱 المنتجات" count={pagination?.total ?? products.length} onAdd={openCreate} addLabel="منتج جديد" />
      <ErrorBanner message={error} onDismiss={clearError} />

      {/* Stock Distribution Tool */}
      <div className="mb-3">
        <button onClick={() => setStockMode(!stockMode)}
          className="chip chip-active flex items-center gap-1">
          📦 توزيع المخزون
        </button>
        {stockMode && (
          <div className="card mt-2 p-3">
            <p className="text-sm text-muted mb-2">اختر نمط توزيع المخزون على جميع المنتجات النشطة:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { mode: "scarce",    icon: "🔴", label: "شحيح",  desc: "2-5 قطع" },
                { mode: "medium",    icon: "🟡", label: "متوسط", desc: "4-9 قطع" },
                { mode: "available", icon: "🟢", label: "متوفر", desc: "7-13 قطعة" },
                { mode: "abundant",  icon: "🔵", label: "وفير",  desc: "10-15 قطعة" },
              ].map((m) => (
                <button key={m.mode} onClick={() => !distributing && distributeStock(m.mode)}
                  disabled={distributing}
                  className="card p-3 text-center hover:border-brand/40 transition-all cursor-pointer disabled:opacity-50">
                  <div className="text-2xl mb-1">{m.icon}</div>
                  <div className="font-bold text-sm">{m.label}</div>
                  <div className="text-xs text-muted">{m.desc}</div>
                </button>
              ))}
            </div>
            {distributing && <p className="text-center text-muted text-xs mt-2">⏳ جاري التوزيع...</p>}
          </div>
        )}
      </div>

      {/* Filters — Type + Stock */}
      <div className="flex gap-1 mb-2 overflow-x-auto">
        {[
          { k: "all", l: "الكل" }, { k: "device", l: "📱 أجهزة" },
          { k: "accessory", l: "🔌 إكسسوارات" }, { k: "low", l: "⚠️ مخزون منخفض" },
          { k: "out", l: "❌ نفذ" },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`chip whitespace-nowrap ${filter === f.k ? "chip-active" : ""}`}>{f.l}</button>
        ))}
      </div>

      {/* Filters — Brand */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        <button onClick={() => setBrandFilter("all")}
          className={`chip whitespace-nowrap ${brandFilter === "all" ? "chip-active" : ""}`}>كل الشركات</button>
        {adminBrands.map((b) => (
          <button key={b} onClick={() => setBrandFilter(b)}
            className={`chip whitespace-nowrap ${brandFilter === b ? "chip-active" : ""}`}>{b}</button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-30 mb-2 card flex items-center justify-between gap-3"
          style={{ padding: "10px 14px", background: "rgba(229,9,20,0.08)", borderColor: "rgba(229,9,20,0.3)" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkConfirm(true)}
              disabled={bulkDeleting}
              className="py-1.5 px-4 rounded-lg bg-state-error text-white text-xs font-bold cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              {bulkDeleting ? "⏳ جاري الحذف..." : `🗑️ حذف ${selected.size} منتج`}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="py-1.5 px-3 rounded-lg border border-surface-border bg-transparent text-muted text-xs cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
          <span className="text-xs font-bold text-brand">{selected.size} محدد</span>
        </div>
      )}

      {/* Products list */}
      {filtered.length === 0 ? (
        <EmptyState icon="📱" title="لا يوجد منتجات" sub="أضف أول منتج" />
      ) : (
        <div className="space-y-1.5">
          {/* Select all */}
          <div className="flex items-center gap-2 px-2 py-1">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              onChange={toggleSelectAll}
              title="تحديد الكل"
              className="w-4 h-4 rounded cursor-pointer accent-[#e50914] flex-shrink-0"
            />
            <span className="text-[10px] text-muted">تحديد الكل ({filtered.length})</span>
          </div>
          {filtered.map((p) => (
            <div key={p.id} className="card flex items-center gap-2 cursor-pointer hover:border-brand/30 transition-all"
              style={{
                padding: scr.mobile ? "10px 12px" : "14px 18px",
                borderColor: selected.has(p.id) ? "rgba(229,9,20,0.4)" : undefined,
                background: selected.has(p.id) ? "rgba(229,9,20,0.04)" : undefined,
              }}
              onClick={() => openEdit(p)}>

              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleSelect(p.id)}
                title="تحديد المنتج"
                className="w-4 h-4 rounded cursor-pointer accent-[#e50914] flex-shrink-0"
              />

              {/* Actions — left side (RTL) */}
              <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setConfirm(p.id)}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center flex-shrink-0">🗑</button>
                <Toggle value={p.active} onChange={async (v) => { await update(p.id, { active: v }); show(v ? "✅ مفعّل" : "⏸️ معطّل"); }} />
              </div>

              {/* Price */}
              <div className="text-left flex-shrink-0">
                <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>₪{Number(p.price).toLocaleString()}</div>
                {p.old_price && <div className="text-dim line-through text-[10px]">₪{Number(p.old_price).toLocaleString()}</div>}
              </div>

              {/* Info — center */}
              <div className="flex-1 text-right">
                <div className="font-bold flex items-center gap-1.5 justify-end" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                  {p.name_ar}
                  {p.featured && <span className="badge bg-brand/15 text-brand">🔥</span>}
                  {!p.active && <span className="badge bg-dim/20 text-dim">معطّل</span>}
                </div>
                <div className="text-muted flex items-center gap-1.5 justify-end" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  <span>{PRODUCT_TYPES[p.type as keyof typeof PRODUCT_TYPES]?.icon} {p.brand}</span>
                  <span>•</span>
                  <span>مخزون: {p.stock === 0 ? <span className="text-state-error">نفذ</span> : p.stock <= 5 ? <span className="text-state-warning">{p.stock}</span> : p.stock}</span>
                  <span>•</span>
                  <span>بيع: {p.sold}</span>
                  {p.type === "accessory" && <>
                    <span>•</span>
                    <span>هامش: {calcMargin(Number(p.price), Number(p.cost))}%</span>
                  </>}
                </div>
              </div>

              {/* Product thumbnail — right side (RTL), first thing user sees */}
              <div className="flex-shrink-0">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name_ar}
                    className="object-contain rounded-lg bg-surface-elevated"
                    style={{ width: scr.mobile ? 44 : 52, height: scr.mobile ? 44 : 52 }}
                  />
                ) : (
                  <div
                    className="rounded-lg border-2 border-dashed border-state-warning/40 bg-state-warning/5 flex items-center justify-center"
                    style={{ width: scr.mobile ? 44 : 52, height: scr.mobile ? 44 : 52, fontSize: scr.mobile ? 16 : 20 }}
                    title="بحاجة لصورة"
                  >
                    📷
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 cursor-pointer disabled:cursor-default hover:bg-surface-elevated"
              >
                ← السابق
              </button>
              <span className="text-sm text-muted">
                صفحة {pagination.page} من {pagination.totalPages} ({pagination.total} منتج)
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 cursor-pointer disabled:cursor-default hover:bg-surface-elevated"
              >
                التالي →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Product Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل منتج" : "منتج جديد"} wide
        footer={<button onClick={handleSave} disabled={aiProcessing} className="btn-primary w-full disabled:opacity-60">{aiProcessing ? "🤖 جاري المعالجة الذكية..." : editId ? "💾 حفظ التعديلات" : "✅ إضافة المنتج"}</button>}>
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 14 }}>
          <div className="flex-1">
            <FormField label="النوع" required>
              <div className="flex gap-1.5">
                {(["device", "accessory"] as const).map((t) => (
                  <button key={t} onClick={() => setForm(prev => ({ ...prev, type: t }))}
                    className={`chip flex-1 ${form.type === t ? "chip-active" : ""}`}>
                    {PRODUCT_TYPES[t].icon} {PRODUCT_TYPES[t].label}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="الماركة" required>
              <input className="input" value={form.brand || ""} onChange={(e) => { setForm(prev => ({ ...prev, brand: e.target.value })); if (nameEn) handleNameEnChange(nameEn); }} placeholder="Samsung, Apple..." />
            </FormField>

            {/* === AI: English name input (primary) === */}
            <FormField label="🤖 اسم المنتج (بالإنجليزية)">
              <input
                className="input font-bold"
                value={nameEn}
                onChange={(e) => handleNameEnChange(e.target.value)}
                placeholder="iPhone 17 Pro Max"
                dir="ltr"
                style={{ borderColor: nameEn ? "rgba(16,185,129,0.4)" : undefined, background: nameEn ? "rgba(16,185,129,0.04)" : undefined }}
              />
              <div className="text-[9px] text-muted mt-0.5 text-right">اكتب الاسم بالإنجليزية — يُترجم تلقائياً عند الحفظ 🔄</div>
            </FormField>

            {/* Duplicate Warning */}
            {duplicateWarning.length > 0 && (
              <div className="rounded-xl p-2.5 mb-2" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)" }}>
                <div className="font-bold text-[11px] text-state-warning mb-1">⚠️ منتج مشابه موجود:</div>
                {duplicateWarning.map((d, i) => (
                  <div key={i} className="text-[10px] text-muted">
                    • {d.name} {d.confidence === "exact" ? "(مطابق تماماً ❌)" : "(مشابه ⚠️)"}
                  </div>
                ))}
              </div>
            )}

            <FormField label="الاسم (عربي)" required>
              <input className="input" value={form.name_ar || ""} onChange={(e) => setForm(prev => ({ ...prev, name_ar: e.target.value }))} placeholder="آيفون 17 برو ماكس" />
            </FormField>
            <FormField label="الاسم (عبري)">
              <input className="input" value={form.name_he || ""} onChange={(e) => setForm(prev => ({ ...prev, name_he: e.target.value }))} dir="rtl" placeholder="אייפון 17 פרו מקס" />
            </FormField>
            <FormField label="الوصف (عربي)">
              <textarea className="input min-h-[60px] resize-y" value={form.description_ar || ""} onChange={(e) => setForm(prev => ({ ...prev, description_ar: e.target.value }))} placeholder="يُولّد تلقائياً من المواصفات عند الحفظ..." />
            </FormField>
            <FormField label="الوصف (عبري)">
              <textarea className="input min-h-[60px] resize-y" value={form.description_he || ""} onChange={(e) => setForm(prev => ({ ...prev, description_he: e.target.value }))} dir="rtl" placeholder="נוצר אוטומטית מהמפרט בעת השמירה..." />
            </FormField>

            {/* ===== Auto-Fill (MobileAPI / GSMArena) ===== */}
            {form.type === "device" && (
              <div className="relative mb-3">
                {/* Main auto-fill button */}
                <button
                  onClick={() => {
                    if (autoFilling) return;
                    if (!form.brand || (!form.name_ar && !nameEn)) {
                      show("❌ أدخل اسم المنتج والشركة أولاً", "error");
                      return;
                    }
                    setShowProviderPicker(!showProviderPicker);
                  }}
                  disabled={autoFilling}
                  className="w-full py-2.5 rounded-xl font-extrabold cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                    color: "white",
                    border: "none",
                    fontSize: scr.mobile ? 12 : 14,
                  }}
                >
                  {autoFilling ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      جاري جلب البيانات...
                    </>
                  ) : (
                    <>
                      🤖 جلب المواصفات والألوان والصور تلقائياً
                    </>
                  )}
                </button>

                {/* Provider picker dropdown */}
                {showProviderPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProviderPicker(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl border border-white/10" style={{ background: "var(--surface-elevated, #1e293b)" }}>
                      <div className="text-[10px] text-center py-1.5 font-bold opacity-60 border-b border-white/10">اختر مزود البيانات</div>
                      <button
                        onClick={() => handleAutoFill("combined")}
                        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-0 border-b border-white/5 transition-all hover:brightness-125"
                        style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.15) 0%, transparent 100%)" }}
                      >
                        <span className="text-xl">🔗</span>
                        <div className="text-right flex-1">
                          <div className="font-extrabold text-[13px]" style={{ color: "#8b5cf6" }}>مدمج (MobileAPI + GSMArena)</div>
                          <div className="text-[9px] opacity-60">بيانات API + صور ألوان GSMArena — الأدق 🎯</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: "#7c3aed", color: "white" }}>موصى</span>
                      </button>
                      <button
                        onClick={() => handleAutoFill("mobileapi")}
                        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-0 border-b border-white/5 transition-all hover:brightness-125"
                        style={{ background: "linear-gradient(90deg, rgba(5,150,105,0.15) 0%, transparent 100%)" }}
                      >
                        <span className="text-xl">📡</span>
                        <div className="text-right flex-1">
                          <div className="font-extrabold text-[13px]" style={{ color: "#10b981" }}>MobileAPI</div>
                          <div className="text-[9px] opacity-60">API رسمي — سريع ودقيق ✅</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleAutoFill("gsmarena")}
                        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-0 transition-all hover:brightness-125"
                        style={{ background: "linear-gradient(90deg, rgba(230,126,34,0.1) 0%, transparent 100%)" }}
                      >
                        <span className="text-xl">🌐</span>
                        <div className="text-right flex-1">
                          <div className="font-extrabold text-[13px]" style={{ color: "#f39c12" }}>GSMArena</div>
                          <div className="text-[9px] opacity-60">Scraping — صور ألوان فقط 📸</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ===== Image Upload Section ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(6,182,212,0.04)", borderColor: "rgba(6,182,212,0.15)" }}>
              <div className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>📸 صورة المنتج</div>

              {/* Main image preview */}
              {form.image_url && (
                <div className="relative mb-2 bg-surface-elevated rounded-xl flex items-center justify-center cursor-pointer" style={{ height: 120 }} onClick={() => !enhancingImage && setZoomImage(form.image_url!)}>
                  <Image src={form.image_url} alt="صورة" width={200} height={120} className="max-h-[90%] max-w-[90%] object-contain rounded-lg" />
                  <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">🔍</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, image_url: undefined })); }}
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-state-error/80 text-white text-xs flex items-center justify-center cursor-pointer border-0"
                  >✕</button>
                  {enhancingImage && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-xl z-10">
                      <div className="text-2xl animate-pulse mb-1">✨</div>
                      <div className="text-white text-[11px] font-bold">{enhanceLabel || "جاري التحسين..."}</div>
                      <div className="text-white/50 text-[9px] mt-0.5">AI Enhancement</div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload / URL input */}
              <div className="flex gap-1.5 mb-1.5">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleMainImage} title="رفع صورة المنتج" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 py-2 rounded-lg border border-brand/30 bg-brand/5 text-brand text-xs font-bold cursor-pointer flex items-center justify-center gap-1"
                >
                  {uploading ? "⏳ جاري الرفع..." : "📷 رفع من الجهاز"}
                </button>
                <button
                  onClick={() => { setPayngoOpen(!payngoOpen); setPayngoQuery(form.name_en || form.name_ar || ""); }}
                  className="py-2 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold cursor-pointer flex items-center justify-center gap-1"
                >
                  🛒 PaynGo
                </button>
                {form.image_url && (
                  <div className="relative">
                    <button
                      onClick={() => !enhancingImage && setEnhanceMenu(!enhanceMenu)}
                      disabled={enhancingImage}
                      className="py-2 px-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-bold cursor-pointer flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                      {enhancingImage ? "⏳ جاري..." : `✨ تحسين (${[form.image_url ? 1 : 0, ...(form.gallery || []).map(() => 1), ...(form.colors || []).filter(c => c.image).map(() => 1)].reduce((a, b) => a + b, 0)} صورة)`}
                    </button>
                    {enhanceMenu && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-surface-bg border border-surface-border rounded-xl shadow-xl overflow-hidden" style={{ minWidth: 200 }}>
                        <div className="px-3 py-1.5 text-[9px] text-muted border-b border-surface-border bg-surface-elevated/50">
                          سيتم تطبيقه على جميع الصور (الرئيسية + المعرض + الألوان)
                        </div>
                        <button onClick={() => handleEnhanceImage("removebg")} className="w-full px-3 py-2.5 text-right text-xs font-semibold text-purple-400 hover:bg-purple-500/10 border-0 cursor-pointer flex items-center gap-2 bg-transparent">
                          🔲 إزالة الخلفية
                        </button>
                        <button onClick={() => handleEnhanceImage("optimize")} className="w-full px-3 py-2.5 text-right text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 border-0 cursor-pointer flex items-center gap-2 bg-transparent">
                          📐 تحسين الحجم والجودة
                        </button>
                        <button onClick={() => handleEnhanceImage("both")} className="w-full px-3 py-2.5 text-right text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 border-0 cursor-pointer flex items-center gap-2 bg-transparent">
                          ✨ الكل (إزالة + تحسين)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <FormField label="أو رابط صورة مباشر">
                <input className="input text-xs" dir="ltr" value={form.image_url || ""} onChange={(e) => setForm(prev => ({ ...prev, image_url: e.target.value || undefined }))} placeholder="https://..." />
              </FormField>
              <div className="text-[9px] text-muted text-right mt-0.5">📐 المقاس المفضّل: {IMAGE_DIMS.product}</div>

              {/* PaynGo Image Import */}
              {payngoOpen && (
                <div className="card mt-2 mb-2 p-2.5 border-emerald-500/20">
                  <div className="flex gap-1.5 mb-2">
                    <input
                      className="input text-xs flex-1"
                      dir="ltr"
                      value={payngoQuery}
                      onChange={(e) => setPayngoQuery(e.target.value)}
                      placeholder="Search PaynGo... e.g. Galaxy S25 Ultra"
                      onKeyDown={(e) => e.key === "Enter" && searchPaynGo()}
                    />
                    <button
                      onClick={searchPaynGo}
                      disabled={payngoLoading}
                      className="py-1.5 px-3 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold cursor-pointer border border-emerald-500/30"
                    >
                      {payngoLoading ? "⏳" : "🔍 بحث"}
                    </button>
                  </div>
                  {payngoResults.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                      {payngoResults.map((r, i) => (
                        <div
                          key={i}
                          onClick={() => selectPaynGoImage(r.image_url)}
                          className="bg-surface-elevated rounded-lg p-1.5 cursor-pointer hover:border-emerald-500/50 border border-transparent transition-all"
                        >
                          <Image src={r.image_url} alt={r.name} width={100} height={64} className="w-full h-16 object-contain mb-1" />
                          <div className="text-[8px] text-muted text-center leading-tight line-clamp-2">{r.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Gallery */}
              <div className="font-bold text-right mt-3 mb-1.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>🖼️ معرض صور إضافية</div>
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {(form.gallery || []).map((url, i) => (
                  <div key={i} className="relative w-16 h-16 bg-surface-elevated rounded-lg overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => setZoomImage(url)}>
                    <Image src={url} alt={`صورة ${i + 1}`} width={64} height={64} className="max-h-full max-w-full object-contain" />
                    <button
                      onClick={() => removeGalleryImage(i)}
                      className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-state-error/80 text-white text-[8px] flex items-center justify-center cursor-pointer border-0"
                    >✕</button>
                  </div>
                ))}
              </div>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" multiple onChange={handleGalleryImages} title="رفع صور المعرض" />
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-1.5 rounded-lg border border-dashed border-surface-border text-muted text-[10px] cursor-pointer bg-transparent"
              >
                {uploading ? "⏳ جاري الرفع..." : "+ إضافة صور للمعرض (يمكن اختيار عدة صور)"}
              </button>
            </div>

            {/* ===== Colors Section ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(168,85,247,0.04)", borderColor: "rgba(168,85,247,0.15)" }}>
              <div className="flex justify-between items-center mb-2">
                <button onClick={addColor} className="text-[10px] px-2 py-1 rounded-lg bg-state-purple/10 text-state-purple border border-state-purple/30 cursor-pointer font-bold">+ لون</button>
                <div className="font-bold text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>🎨 الألوان</div>
              </div>
              {/* Apply all suggested color images */}
              {Object.keys(suggestedColorImages).length > 0 && (form.colors || []).some((c, i) => !c.image && suggestedColorImages[i]) && (
                <button
                  onClick={() => {
                    const updated = [...(form.colors || [])];
                    for (const [idx, url] of Object.entries(suggestedColorImages)) {
                      const i = Number(idx);
                      if (updated[i] && !updated[i].image) {
                        updated[i] = { ...updated[i], image: url };
                      }
                    }
                    setForm(prev => ({ ...prev, colors: updated }));
                    show("✅ تم تطبيق جميع صور الألوان المقترحة");
                  }}
                  className="w-full py-1.5 rounded-lg bg-brand/10 text-brand text-[10px] cursor-pointer border border-brand/30 font-bold mb-2"
                >
                  ✨ تطبيق جميع صور الألوان المقترحة ({Object.keys(suggestedColorImages).filter(i => !(form.colors || [])[Number(i)]?.image).length})
                </button>
              )}
              {/* Bulk fetch all color images */}
              {(form.colors || []).length > 0 && (form.colors || []).some(c => !c.image) && (
                <button
                  onClick={fetchAllColorImages}
                  disabled={bulkColorLoading}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500/10 via-orange-500/10 to-sky-500/10 text-[11px] cursor-pointer border border-emerald-500/30 font-bold mb-2 flex items-center justify-center gap-2"
                >
                  {bulkColorLoading
                    ? <><span className="animate-spin">⏳</span> جاري البحث في PaynGo + GSMArena...</>
                    : <>🎨 جلب صور جميع الألوان تلقائياً ({(form.colors || []).filter(c => !c.image).length} ألوان بدون صور)</>
                  }
                </button>
              )}
              {(form.colors || []).length === 0 && (
                <div className="text-center text-dim text-[10px] py-2">لم تتم إضافة ألوان</div>
              )}
              {(form.colors || []).map((c, i) => (
                <div key={i} className="bg-surface-elevated rounded-lg p-2 mb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <button onClick={() => removeColor(i)} className="w-5 h-5 rounded-md border border-state-error/30 bg-transparent text-state-error text-[8px] cursor-pointer flex items-center justify-center flex-shrink-0">✕</button>
                    <input className="input text-xs flex-1" value={c.name_ar} onChange={(e) => updateColor(i, "name_ar", e.target.value)} placeholder="أسود" />
                    <input className="input text-xs flex-1" value={c.name_he} onChange={(e) => updateColor(i, "name_he", e.target.value)} placeholder="שחור" />
                    <div className="relative flex-shrink-0">
                      <input type="color" value={c.hex} onChange={(e) => updateColor(i, "hex", e.target.value)}
                        title="اختيار لون" className="w-8 h-8 rounded-lg border border-surface-border cursor-pointer" style={{ padding: 1 }} />
                    </div>
                  </div>
                  {/* Color-specific image */}
                  <div className="flex items-center gap-1.5">
                    {c.image && (
                      <div className="relative w-12 h-12 bg-surface-bg rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setZoomImage(c.image!)}>
                        <Image src={c.image} alt={c.name_ar || "لون"} width={48} height={48} className="max-h-full max-w-full object-contain" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setForm(prev => { const updated = [...(prev.colors || [])]; updated[i] = { ...updated[i], image: undefined }; return { ...prev, colors: updated }; }); }}
                          className="absolute top-0 left-0 w-3.5 h-3.5 rounded-full bg-state-error/80 text-white text-[7px] flex items-center justify-center cursor-pointer border-0"
                        >✕</button>
                      </div>
                    )}
                    {/* Show suggested image if available and not already set */}
                    {!c.image && suggestedColorImages[i] && (
                      <div
                        className="relative w-12 h-12 bg-surface-bg rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer border-2 border-dashed border-brand/40 hover:border-brand"
                        title="اضغط لاستخدام هذه الصورة"
                        onClick={() => {
                          setForm(prev => { const updated = [...(prev.colors || [])]; updated[i] = { ...updated[i], image: suggestedColorImages[i] }; return { ...prev, colors: updated }; });
                          show("✅ تم تطبيق صورة اللون");
                        }}
                      >
                        <Image src={suggestedColorImages[i]} alt="" width={48} height={48} className="max-h-full max-w-full object-contain opacity-70" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-[8px] font-bold">✨ اقتراح</div>
                      </div>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      ref={(el) => { colorInputRefs.current[i] = el; }}
                      onChange={(e) => handleColorImage(e, i)}
                      title="رفع صورة اللون"
                    />
                    <button
                      onClick={() => colorInputRefs.current[i]?.click()}
                      disabled={uploadingColor === i}
                      className="flex-1 py-1.5 rounded-lg border border-dashed border-state-purple/30 text-state-purple text-[9px] cursor-pointer bg-transparent"
                    >
                      {uploadingColor === i ? "⏳ جاري..." : c.image ? "📷 تغيير صورة اللون" : "📷 رفع صورة لهذا اللون"}
                    </button>
                    <button
                      onClick={() => importPaynGoColorImage(i)}
                      disabled={payngoColorLoading === i}
                      className="py-1.5 px-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] cursor-pointer flex-shrink-0"
                      title="PaynGo"
                    >
                      {payngoColorLoading === i ? "⏳" : "🛒"}
                    </button>
                    <button
                      onClick={() => importGsmaColorImage(i)}
                      disabled={gsmaColorLoading === i}
                      className="py-1.5 px-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[9px] cursor-pointer flex-shrink-0"
                      title="GSMArena"
                    >
                      {gsmaColorLoading === i ? "⏳" : "📱"}
                    </button>
                    <button
                      onClick={() => openPexelsForColor(i)}
                      disabled={pexelsOpen === i && pexelsLoading}
                      className="py-1.5 px-2 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400 text-[9px] cursor-pointer flex-shrink-0"
                      title="Pexels"
                    >
                      {pexelsOpen === i && pexelsLoading ? "⏳" : "🔍"}
                    </button>
                  </div>
                  {/* Pexels results picker */}
                  {pexelsOpen === i && pexelsResults.length > 0 && (
                    <div className="mt-1.5 p-2 bg-surface-bg rounded-lg border border-sky-500/20">
                      <div className="flex justify-between items-center mb-1.5">
                        <button onClick={() => { setPexelsOpen(null); setPexelsResults([]); }} className="text-[8px] text-dim cursor-pointer bg-transparent border-0">✕ إغلاق</button>
                        <span className="text-[9px] text-sky-400 font-bold">🔍 Pexels — اختر صورة</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {pexelsResults.map((photo) => (
                          <div
                            key={photo.id}
                            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-sky-500 transition-all"
                            onClick={() => selectPexelsImage(i, photo.src)}
                          >
                            <Image src={photo.thumb} alt={photo.alt} width={100} height={100} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Apply all suggested images button */}
                  {!c.image && suggestedColorImages[i] && (
                    <div className="text-[8px] text-brand text-right mt-0.5 opacity-70">
                      ✨ صورة مقترحة — اضغط عليها لتطبيقها
                    </div>
                  )}
                  {/* Manual URL paste */}
                  {!c.image && (
                    <div className="flex gap-1 mt-1">
                      <input
                        className="input text-[9px] flex-1"
                        placeholder="🔗 الصق رابط صورة..."
                        dir="ltr"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const url = (e.target as HTMLInputElement).value.trim();
                            if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                              setForm(prev => {
                                const updated = [...(prev.colors || [])];
                                updated[i] = { ...updated[i], image: url };
                                return { ...prev, colors: updated };
                              });
                              (e.target as HTMLInputElement).value = "";
                              show("✅ تم تطبيق الصورة");
                            }
                          }
                        }}
                      />
                      <button
                        className="text-[8px] px-2 py-1 rounded bg-surface-bg border border-surface-border text-muted cursor-pointer"
                        onClick={(e) => {
                          const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                          const url = input?.value?.trim();
                          if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                            setForm(prev => {
                              const updated = [...(prev.colors || [])];
                              updated[i] = { ...updated[i], image: url };
                              return { ...prev, colors: updated };
                            });
                            input.value = "";
                            show("✅ تم تطبيق الصورة");
                          }
                        }}
                      >تطبيق</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ===== Variants Section (per-storage pricing) ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.15)" }}>
              <div className="flex justify-between items-center mb-2">
                <button onClick={addVariant} className="text-[10px] px-2 py-1 rounded-lg bg-state-success/10 text-state-success border border-state-success/30 cursor-pointer font-bold">+ سعة</button>
                <div className="font-bold text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>💾 تسعير حسب السعة</div>
              </div>
              {(form.variants || []).length === 0 ? (
                <div className="text-center text-dim text-[10px] py-2">
                  لا يوجد — سيتم استخدام السعر الأساسي لجميع الخيارات
                </div>
              ) : (
                <>
                  <div className="text-muted text-[9px] text-right mb-2">كل سعة بسعر ومخزون مختلف. الخيارات ستظهر في كرت المنتج.</div>
                  {(form.variants || []).map((v, i) => (
                    <div key={i} className="bg-surface-elevated rounded-lg p-2 mb-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <button onClick={() => removeVariant(i)} className="w-5 h-5 rounded-md border border-state-error/30 bg-transparent text-state-error text-[8px] cursor-pointer flex items-center justify-center flex-shrink-0">✕</button>
                        <input className="input text-xs flex-1" value={v.storage} onChange={(e) => { updateVariant(i, "storage", e.target.value); }} placeholder="256GB" dir="ltr" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <div className="text-muted text-[8px] text-right mb-0.5">سعر البيع ₪</div>
                          <input className="input text-xs" type="number" value={v.price || ""} onChange={(e) => updateVariant(i, "price", Number(e.target.value))} placeholder="0" dir="ltr" />
                        </div>
                        <div>
                          <div className="text-muted text-[8px] text-right mb-0.5">سعر قبل الخصم ₪</div>
                          <input className="input text-xs" type="number" value={v.old_price || ""} onChange={(e) => updateVariant(i, "old_price", Number(e.target.value) || undefined)} placeholder="0" dir="ltr" />
                        </div>
                        <div>
                          <div className="text-muted text-[8px] text-right mb-0.5">التكلفة ₪</div>
                          <input className="input text-xs" type="number" value={v.cost || ""} onChange={(e) => updateVariant(i, "cost", Number(e.target.value))} placeholder="0" dir="ltr" />
                        </div>
                        <div>
                          <div className="text-muted text-[8px] text-right mb-0.5">المخزون</div>
                          <input className="input text-xs" type="number" value={v.stock ?? ""} onChange={(e) => updateVariant(i, "stock", Number(e.target.value))} placeholder="0" dir="ltr" />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="flex-1">
            {/* Price fields for devices (simple) */}
            {form.type === "device" && (
              <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
                <div className="flex gap-2 mb-1.5">
                  <FormField label="سعر البيع ₪" required>
                    <input className="input" type="number" value={form.price || ""} onChange={(e) => setForm(prev => ({ ...prev, price: Number(e.target.value) }))} placeholder="0" dir="ltr" />
                  </FormField>
                  <FormField label="التكلفة ₪" required>
                    <input className="input" type="number" value={form.cost || ""} onChange={(e) => setForm(prev => ({ ...prev, cost: Number(e.target.value) }))} placeholder="0" dir="ltr" />
                  </FormField>
                </div>
                <FormField label="سعر قبل الخصم ₪ (اختياري)">
                  <input className="input" type="number" value={form.old_price || ""} onChange={(e) => setForm(prev => ({ ...prev, old_price: Number(e.target.value) || undefined }))} placeholder="0" dir="ltr" />
                </FormField>
              </div>
            )}
            {/* Margin Calculator - accessories only */}
            {form.type === "accessory" && (
              <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(196,16,64,0.04)", borderColor: "rgba(196,16,64,0.15)" }}>
                <div className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>💰 حاسبة الهامش</div>
                <div className="flex gap-2 mb-1.5">
                  <FormField label="سعر البيع ₪" required>
                    <input className="input" type="number" value={form.price || ""} onChange={(e) => setForm(prev => ({ ...prev, price: Number(e.target.value) }))} placeholder="0" dir="ltr" />
                  </FormField>
                  <FormField label="التكلفة ₪" required>
                    <input className="input" type="number" value={form.cost || ""} onChange={(e) => setForm(prev => ({ ...prev, cost: Number(e.target.value) }))} placeholder="0" dir="ltr" />
                  </FormField>
                </div>
                <FormField label="سعر قبل الخصم ₪ (اختياري)">
                  <input className="input" type="number" value={form.old_price || ""} onChange={(e) => setForm(prev => ({ ...prev, old_price: Number(e.target.value) || undefined }))} placeholder="0" dir="ltr" />
                </FormField>
                <div className="flex justify-between mt-1">
                  <span style={{ fontSize: 11, color: margin >= 30 ? "#22c55e" : margin >= 15 ? "#eab308" : "#ef4444" }}>
                    الهامش: {margin}%
                  </span>
                  <span style={{ fontSize: 11, color: profit > 0 ? "#22c55e" : "#ef4444" }}>
                    الربح: ₪{profit}
                  </span>
                </div>
              </div>
            )}

            <FormField label="المخزون">
              <input className="input" type="number" value={form.stock || 0} onChange={(e) => setForm(prev => ({ ...prev, stock: Number(e.target.value) }))} placeholder="0" dir="ltr" />
            </FormField>

            <div className="flex gap-3 mt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={form.active !== false} onChange={(v) => setForm(prev => ({ ...prev, active: v }))} />
                <span className="text-xs text-muted">مفعّل</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={!!form.featured} onChange={(v) => setForm(prev => ({ ...prev, featured: v }))} />
                <span className="text-xs text-muted">🔥 مميز</span>
              </label>
            </div>
          </div>
        </div>

      </Modal>

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

      {/* Image Zoom Lightbox */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center cursor-pointer border-0 hover:bg-white/30 transition-colors"
          >✕</button>
          <img
            src={zoomImage}
            alt="تكبير"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
