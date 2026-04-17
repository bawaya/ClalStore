"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Modal, FormField } from "@/components/admin/shared";
import { csrfHeaders } from "@/lib/csrf-client";
import { formatCurrency } from "@/lib/utils";

type CatalogProduct = {
  id: string;
  brand: string;
  name_ar: string;
  name_he?: string;
  price: number;
  type: "device" | "accessory";
  active: boolean;
};

type OrderItemForm = {
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
};

export type ManualOrderFormState = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: OrderItemForm[];
  discount: number;
  shipping: number;
  notes?: string;
  payment_method?: string;
  source: "manual" | "phone" | "pipeline";
  deal_id?: string;
  status?: string;
};

const EMPTY_STATE: ManualOrderFormState = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  items: [],
  discount: 0,
  shipping: 0,
  notes: "",
  payment_method: "cash",
  source: "manual",
  status: "new",
};

function normalizeState(initialValues?: Partial<ManualOrderFormState>): ManualOrderFormState {
  return {
    ...EMPTY_STATE,
    ...initialValues,
    items: initialValues?.items?.length ? initialValues.items.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
    })) : [],
    discount: Number(initialValues?.discount || 0),
    shipping: Number(initialValues?.shipping || 0),
  };
}

export function ManualOrderModal({
  open,
  onClose,
  onCreated,
  show,
  endpoint = "/api/admin/orders/create",
  title = "הזמנה ידנית חדשה",
  submitLabel = "צור הזמנה",
  initialValues,
  lockSource = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (order: any) => void;
  show: (message: string, type?: "success" | "error") => void;
  endpoint?: string;
  title?: string;
  submitLabel?: string;
  initialValues?: Partial<ManualOrderFormState>;
  lockSource?: boolean;
}) {
  const [form, setForm] = useState<ManualOrderFormState>(normalizeState(initialValues));
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const deferredQuery = useDeferredValue(productQuery);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  useEffect(() => {
    if (!open) return;
    setForm(normalizeState(initialValues));
  }, [open, initialValues]);

  useEffect(() => {
    if (!open || products.length > 0 || loadingProducts) return;

    let active = true;
    setLoadingProducts(true);
    fetch("/api/admin/products?limit=200")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        setProducts((json.data || []).filter((product: CatalogProduct) => product.active !== false));
      })
      .catch(() => {
        if (!active) return;
        show("❌ فشل تحميل المنتجات", "error");
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [open, products.length, loadingProducts, show]);

  const filteredProducts = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!query) return products.slice(0, 30);
    return products
      .filter((product) =>
        `${product.brand} ${product.name_ar} ${product.name_he || ""}`.toLowerCase().includes(query),
      )
      .slice(0, 30);
  }, [products, deferredQuery]);

  const subtotal = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [form.items],
  );
  const total = useMemo(
    () => Math.max(0, subtotal - Number(form.discount || 0) + Number(form.shipping || 0)),
    [subtotal, form.discount, form.shipping],
  );

  const addCatalogProduct = () => {
    const product = products.find((entry) => entry.id === selectedProductId);
    if (!product) return;

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          product_id: product.id,
          name: product.name_ar,
          price: Number(product.price || 0),
          quantity: selectedQuantity || 1,
        },
      ],
    }));
    setSelectedProductId("");
    setSelectedQuantity(1);
    setProductQuery("");
  };

  const addManualItem = () => {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        { name: "", price: 0, quantity: 1 },
      ],
    }));
  };

  const updateItem = (index: number, field: keyof OrderItemForm, value: string | number) => {
    setForm((current) => {
      const items = [...current.items];
      items[index] = {
        ...items[index],
        [field]: field === "price" || field === "quantity" ? Number(value) : value,
      };
      return { ...current, items };
    });
  };

  const removeItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      show("❌ יש למלא שם וטלפון", "error");
      return;
    }
    if (form.items.length === 0) {
      show("❌ יש להוסיף לפחות מוצר אחד", "error");
      return;
    }

    const cleanedItems = form.items
      .map((item) => ({
        product_id: item.product_id,
        name: item.name.trim(),
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 0),
      }))
      .filter((item) => item.name && item.quantity > 0);

    if (cleanedItems.length === 0) {
      show("❌ פריטי ההזמנה לא תקינים", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          ...form,
          items: cleanedItems,
          subtotal,
          total,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "שגיאה ביצירת ההזמנה");
      }
      show(`✅ הזמנה נוצרה ${json.data?.id || ""}`.trim());
      onCreated?.(json.data);
      onClose();
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה לא צפויה"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={(
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1">ביטול</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
            {saving ? "יוצר..." : submitLabel}
          </button>
        </div>
      )}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="שם לקוח" required>
          <input
            className="input"
            value={form.customer_name}
            onChange={(e) => setForm((current) => ({ ...current, customer_name: e.target.value }))}
          />
        </FormField>
        <FormField label="טלפון" required>
          <input
            className="input"
            value={form.customer_phone}
            onChange={(e) => setForm((current) => ({ ...current, customer_phone: e.target.value }))}
            dir="ltr"
          />
        </FormField>
        <FormField label="אימייל">
          <input
            className="input"
            value={form.customer_email || ""}
            onChange={(e) => setForm((current) => ({ ...current, customer_email: e.target.value }))}
            dir="ltr"
          />
        </FormField>
        <FormField label="אמצעי תשלום">
          <select
            className="input"
            value={form.payment_method || "cash"}
            onChange={(e) => setForm((current) => ({ ...current, payment_method: e.target.value }))}
          >
            <option value="cash">מזומן</option>
            <option value="credit">אשראי</option>
            <option value="bank">העברה בנקאית</option>
            <option value="phone">טלפוני</option>
          </select>
        </FormField>
      </div>

      <div className="card mt-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={addManualItem} className="chip">+ פריט ידני</button>
          <div className="font-bold text-sm">מוצרים</div>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr,160px,90px,90px]">
          <input
            className="input"
            placeholder={loadingProducts ? "טוען מוצרים..." : "חיפוש מוצר..."}
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
          />
          <select
            className="input"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">בחר מוצר</option>
            {filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.brand} · {product.name_ar}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            min={1}
            value={selectedQuantity}
            onChange={(e) => setSelectedQuantity(Number(e.target.value || 1))}
            dir="ltr"
          />
          <button onClick={addCatalogProduct} disabled={!selectedProductId} className="btn-outline disabled:opacity-50">
            + הוסף
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {form.items.map((item, index) => (
            <div key={`${item.product_id || "manual"}-${index}`} className="rounded-xl border border-surface-border p-3">
              <div className="grid gap-2 md:grid-cols-[1fr,120px,100px,48px]">
                <input
                  className="input"
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder="שם מוצר"
                />
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={item.price}
                  onChange={(e) => updateItem(index, "price", Number(e.target.value || 0))}
                  dir="ltr"
                />
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", Number(e.target.value || 1))}
                  dir="ltr"
                />
                <button onClick={() => removeItem(index)} className="btn-outline text-state-error">✕</button>
              </div>
              <div className="mt-2 text-left text-xs text-muted">
                {formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <FormField label="הנחה">
          <input
            className="input"
            type="number"
            min={0}
            value={form.discount}
            onChange={(e) => setForm((current) => ({ ...current, discount: Number(e.target.value || 0) }))}
            dir="ltr"
          />
        </FormField>
        <FormField label="משלוח">
          <input
            className="input"
            type="number"
            min={0}
            value={form.shipping}
            onChange={(e) => setForm((current) => ({ ...current, shipping: Number(e.target.value || 0) }))}
            dir="ltr"
          />
        </FormField>
        <FormField label="מקור">
          <select
            className="input"
            value={form.source}
            onChange={(e) => setForm((current) => ({ ...current, source: e.target.value as ManualOrderFormState["source"] }))}
            disabled={lockSource}
          >
            <option value="manual">ידני</option>
            <option value="phone">טלפון</option>
            <option value="pipeline">פייפליין</option>
          </select>
        </FormField>
        <FormField label="סטטוס">
          <select
            className="input"
            value={form.status || "new"}
            onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
          >
            <option value="new">חדש</option>
            <option value="approved">מאושר</option>
            <option value="processing">בהכנה</option>
            <option value="shipped">נשלח</option>
          </select>
        </FormField>
      </div>

      <FormField label="הערות">
        <textarea
          className="input min-h-[90px] resize-y"
          value={form.notes || ""}
          onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
        />
      </FormField>

      <div className="card mt-2 p-3 text-sm">
        <div className="flex items-center justify-between py-1">
          <span>{formatCurrency(subtotal)}</span>
          <span className="text-muted">סה״כ מוצרים</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span>{formatCurrency(Number(form.discount || 0))}</span>
          <span className="text-muted">הנחה</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span>{formatCurrency(Number(form.shipping || 0))}</span>
          <span className="text-muted">משלוח</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-surface-border pt-2 text-base font-black">
          <span>{formatCurrency(total)}</span>
          <span>סה״כ לתשלום</span>
        </div>
      </div>
    </Modal>
  );
}
