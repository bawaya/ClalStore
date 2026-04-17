"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  ToastContainer,
} from "@/components/admin/shared";
import {
  ManualOrderModal,
  type ManualOrderFormState,
} from "@/components/orders/ManualOrderModal";
import { csrfHeaders } from "@/lib/csrf-client";
import { useScreen, useToast } from "@/lib/hooks";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";

type PipelineStage = {
  id: number;
  name: string;
  name_he: string;
  name_ar?: string | null;
  color?: string | null;
  sort_order: number;
  is_won?: boolean | null;
  is_lost?: boolean | null;
};

type PipelineDeal = {
  id: string;
  stage_id: number;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  product_name?: string | null;
  product_id?: string | null;
  estimated_value?: number | null;
  employee_id?: string | null;
  employee_name?: string | null;
  notes?: string | null;
  order_id?: string | null;
  converted_at?: string | null;
  lost_reason?: string | null;
  created_at: string;
  updated_at: string;
};

type PipelineStats = {
  total_deals: number;
  total_value: number;
  conversion_rate: number;
  avg_deal_time: number;
};

type CatalogProduct = {
  id: string;
  brand: string;
  name_ar: string;
  price: number;
  active: boolean;
};

type DealFormState = {
  id?: string;
  stage_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  product_id: string;
  product_name: string;
  estimated_value: number;
  notes: string;
  lost_reason: string;
};

const LOST_REASON_OPTIONS = [
  { value: "price", label: "מחיר" },
  { value: "competitor", label: "מתחרה" },
  { value: "timing", label: "תזמון" },
  { value: "no_response", label: "אין תגובה" },
  { value: "other", label: "אחר" },
];

function normalizeDealForm(stages: PipelineStage[], deal?: Partial<PipelineDeal>): DealFormState {
  return {
    id: deal?.id,
    stage_id: Number(deal?.stage_id || stages[0]?.id || 0),
    customer_name: deal?.customer_name || "",
    customer_phone: deal?.customer_phone || "",
    customer_email: deal?.customer_email || "",
    product_id: deal?.product_id || "",
    product_name: deal?.product_name || "",
    estimated_value: Number(deal?.estimated_value || 0),
    notes: deal?.notes || "",
    lost_reason: deal?.lost_reason || "",
  };
}

function getDaysInStage(dateValue?: string | null) {
  if (!dateValue) return 0;
  const diff = Date.now() - new Date(dateValue).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function inDateRange(dateValue: string, from: string, to: string) {
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return false;
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (target < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59`);
    if (target > end) return false;
  }
  return true;
}

export default function PipelinePage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [stats, setStats] = useState<PipelineStats>({
    total_deals: 0,
    total_value: 0,
    conversion_rate: 0,
    avg_deal_time: 0,
  });
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDeal, setSavingDeal] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [dealForm, setDealForm] = useState<DealFormState>({
    stage_id: 0,
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    product_id: "",
    product_name: "",
    estimated_value: 0,
    notes: "",
    lost_reason: "",
  });
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);
  const [deleteDealId, setDeleteDealId] = useState<string | null>(null);
  const [lostMove, setLostMove] = useState<{ deal: PipelineDeal; stage: PipelineStage } | null>(null);
  const [lostReason, setLostReason] = useState("price");
  const [lostReasonOther, setLostReasonOther] = useState("");
  const [convertDeal, setConvertDeal] = useState<PipelineDeal | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lostOpen, setLostOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPipeline() {
      setLoading(true);
      try {
        const [pipelineRes, productsRes] = await Promise.all([
          fetch("/api/crm/pipeline"),
          fetch("/api/admin/products?limit=200"),
        ]);

        const pipelineJson = await pipelineRes.json();
        const productsJson = await productsRes.json();

        if (!pipelineRes.ok || pipelineJson.error) {
          throw new Error(pipelineJson.error || "Failed to load pipeline");
        }
        if (!productsRes.ok || productsJson.error) {
          throw new Error(productsJson.error || "Failed to load products");
        }
        if (!active) return;

        const nextStages = (pipelineJson.data?.stages || pipelineJson.stages || []) as PipelineStage[];
        const nextDeals = (pipelineJson.data?.deals || pipelineJson.deals || []) as PipelineDeal[];
        const nextStats = (pipelineJson.data?.stats || pipelineJson.stats || {}) as PipelineStats;
        const nextProducts = (productsJson.data || []) as CatalogProduct[];

        setStages(nextStages);
        setDeals(nextDeals);
        setStats({
          total_deals: Number(nextStats.total_deals || 0),
          total_value: Number(nextStats.total_value || 0),
          conversion_rate: Number(nextStats.conversion_rate || 0),
          avg_deal_time: Number(nextStats.avg_deal_time || 0),
        });
        setProducts(nextProducts.filter((product) => product.active !== false));
        setDealForm((current) =>
          current.stage_id
            ? current
            : { ...current, stage_id: Number(nextStages[0]?.id || 0) },
        );
      } catch (err: unknown) {
        if (!active) return;
        show(`❌ ${err instanceof Error ? err.message : "שגיאה בטעינת הפייפליין"}`, "error");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPipeline();
    return () => {
      active = false;
    };
  }, [show]);

  const stageMap = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage])),
    [stages],
  );

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (employeeFilter !== "all" && deal.employee_name !== employeeFilter) return false;
      if (productFilter !== "all" && (deal.product_name || "") !== productFilter) return false;
      if (!inDateRange(deal.created_at, dateFrom, dateTo)) return false;
      return true;
    });
  }, [dateFrom, dateTo, deals, employeeFilter, productFilter]);

  const employees = useMemo(
    () => [...new Set(deals.map((deal) => deal.employee_name).filter(Boolean))],
    [deals],
  );

  const productNames = useMemo(
    () => [...new Set(deals.map((deal) => deal.product_name).filter(Boolean))],
    [deals],
  );

  const lostStage = useMemo(
    () => stages.find((stage) => stage.is_lost) || null,
    [stages],
  );

  const mainStages = useMemo(
    () => stages.filter((stage) => !stage.is_lost),
    [stages],
  );

  const lostDeals = useMemo(() => {
    if (!lostStage) return [];
    return filteredDeals.filter((deal) => deal.stage_id === lostStage.id);
  }, [filteredDeals, lostStage]);

  const filteredActiveDeals = useMemo(() => {
    if (!lostStage) return filteredDeals;
    return filteredDeals.filter((deal) => deal.stage_id !== lostStage.id);
  }, [filteredDeals, lostStage]);

  const openNewDeal = () => {
    setSelectedDeal(null);
    setDealForm(normalizeDealForm(stages));
    setDealModalOpen(true);
  };

  const openDealDetails = (deal: PipelineDeal) => {
    setSelectedDeal(deal);
    setDealForm(normalizeDealForm(stages, deal));
    setDealModalOpen(true);
  };

  const refreshPipeline = async () => {
    const res = await fetch("/api/crm/pipeline");
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error || "Failed to refresh pipeline");
    }
    const nextStages = (json.data?.stages || json.stages || []) as PipelineStage[];
    const nextDeals = (json.data?.deals || json.deals || []) as PipelineDeal[];
    const nextStats = (json.data?.stats || json.stats || {}) as PipelineStats;
    setStages(nextStages);
    setDeals(nextDeals);
    setStats({
      total_deals: Number(nextStats.total_deals || 0),
      total_value: Number(nextStats.total_value || 0),
      conversion_rate: Number(nextStats.conversion_rate || 0),
      avg_deal_time: Number(nextStats.avg_deal_time || 0),
    });
  };

  const persistDeal = async () => {
    if (!dealForm.customer_name.trim()) {
      show("❌ יש למלא שם לקוח", "error");
      return;
    }
    if (dealForm.stage_id <= 0) {
      show("❌ בחר שלב תקין", "error");
      return;
    }
    const selectedStage = stageMap.get(dealForm.stage_id);
    if (selectedStage?.is_lost && !dealForm.lost_reason.trim()) {
      show("❌ יש לבחור סיבת אובדן", "error");
      return;
    }

    setSavingDeal(true);
    try {
      const payload = {
        stage_id: dealForm.stage_id,
        customer_name: dealForm.customer_name.trim(),
        customer_phone: dealForm.customer_phone.trim(),
        customer_email: dealForm.customer_email.trim(),
        product_id: dealForm.product_id || undefined,
        product_name: dealForm.product_name.trim(),
        estimated_value: Number(dealForm.estimated_value || 0),
        notes: dealForm.notes.trim(),
        lost_reason: selectedStage?.is_lost ? dealForm.lost_reason.trim() : "",
      };

      const res = await fetch("/api/crm/pipeline", {
        method: selectedDeal ? "PUT" : "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(selectedDeal ? { id: selectedDeal.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to save deal");
      }

      await refreshPipeline();
      setDealModalOpen(false);
      setSelectedDeal(null);
      show(selectedDeal ? "✅ העסקה עודכנה" : "✅ העסקה נוצרה");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה בשמירת העסקה"}`, "error");
    } finally {
      setSavingDeal(false);
    }
  };

  const moveDealToStage = async (
    deal: PipelineDeal,
    targetStage: PipelineStage,
    reason = "",
  ) => {
    try {
      const res = await fetch("/api/crm/pipeline", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({
          id: deal.id,
          stage_id: targetStage.id,
          lost_reason: targetStage.is_lost ? reason : "",
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to move deal");
      }
      await refreshPipeline();
      show(`✅ ${deal.customer_name} → ${targetStage.name_he}`);
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה בהעברת העסקה"}`, "error");
    }
  };

  const askLostReason = (deal: PipelineDeal, stage: PipelineStage) => {
    setLostMove({ deal, stage });
    setLostReason("price");
    setLostReasonOther("");
  };

  const confirmLostMove = async () => {
    if (!lostMove) return;
    const reason = lostReason === "other" ? lostReasonOther.trim() : lostReason;
    if (!reason) {
      show("❌ יש לבחור או להזין סיבת אובדן", "error");
      return;
    }
    const current = lostMove;
    setLostMove(null);
    await moveDealToStage(current.deal, current.stage, reason);
  };

  const deleteDeal = async () => {
    if (!deleteDealId) return;
    try {
      const res = await fetch(`/api/crm/pipeline?id=${deleteDealId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to delete deal");
      }
      setDeleteDealId(null);
      setDealModalOpen(false);
      setSelectedDeal(null);
      await refreshPipeline();
      show("✅ העסקה נמחקה");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה במחיקת העסקה"}`, "error");
    }
  };

  const convertInitialValues = useMemo<Partial<ManualOrderFormState> | undefined>(() => {
    if (!convertDeal) return undefined;
    return {
      customer_name: convertDeal.customer_name,
      customer_phone: convertDeal.customer_phone || "",
      customer_email: convertDeal.customer_email || "",
      items: [
        {
          product_id: convertDeal.product_id || undefined,
          name: convertDeal.product_name || "Pipeline item",
          price: Number(convertDeal.estimated_value || 0),
          quantity: 1,
        },
      ],
      discount: 0,
      shipping: 0,
      notes: convertDeal.notes || "",
      payment_method: "cash",
      source: "pipeline",
      deal_id: convertDeal.id,
      status: "new",
    };
  }, [convertDeal]);

  return (
    <div>
      <PageHeader title="פייפליין מכירות" onAdd={openNewDeal} addLabel="עסקה חדשה" />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="card p-4 text-right">
          <div className="text-xs text-muted">סה״כ עסקאות</div>
          <div className="mt-2 text-2xl font-black text-brand">{stats.total_deals}</div>
        </div>
        <div className="card p-4 text-right">
          <div className="text-xs text-muted">שווי כולל</div>
          <div className="mt-2 text-2xl font-black text-brand">{formatCurrency(stats.total_value)}</div>
        </div>
        <div className="card p-4 text-right">
          <div className="text-xs text-muted">אחוז המרה</div>
          <div className="mt-2 text-2xl font-black text-brand">{stats.conversion_rate}%</div>
        </div>
        <div className="card p-4 text-right">
          <div className="text-xs text-muted">ממוצע סגירה</div>
          <div className="mt-2 text-2xl font-black text-brand">{stats.avg_deal_time} ימים</div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-surface-border bg-surface-card p-4 md:grid-cols-4">
        <FormField label="עובד">
          <select className="input" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
            <option value="all">כל העובדים</option>
            {employees.map((name) => (
              <option key={name} value={name as string}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="מוצר">
          <select className="input" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
            <option value="all">כל המוצרים</option>
            {productNames.map((name) => (
              <option key={name} value={name as string}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="מתאריך">
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </FormField>
        <FormField label="עד תאריך">
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </FormField>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted">טוען פייפליין...</div>
      ) : mainStages.length === 0 ? (
        <EmptyState icon="🎯" title="אין שלבי פייפליין מוגדרים" sub="יש להגדיר שלבים בטבלת pipeline_stages" />
      ) : (
        <>
          <div className="grid gap-3 xl:grid-cols-5">
            {mainStages.map((stage, index) => {
              const stageDeals = filteredActiveDeals.filter((deal) => deal.stage_id === stage.id);
              const previousStage = index > 0 ? mainStages[index - 1] : null;
              const nextStage = index < mainStages.length - 1 ? mainStages[index + 1] : lostStage;

              return (
                <div key={stage.id} className="min-h-[220px] rounded-2xl border border-surface-border bg-surface-card p-3">
                  <div className="mb-3 rounded-xl px-3 py-2 text-right" style={{ background: `${stage.color || "#4DA6FF"}15` }}>
                    <div className="font-black" style={{ color: stage.color || "#4DA6FF" }}>
                      {stage.name_he}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {stageDeals.length} עסקאות · {formatCurrency(stageDeals.reduce((sum, deal) => sum + Number(deal.estimated_value || 0), 0))}
                    </div>
                  </div>

                  {stageDeals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-surface-border px-3 py-8 text-center text-xs text-muted">
                      אין עסקאות בשלב הזה
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stageDeals.map((deal) => (
                        <div key={deal.id} className="rounded-2xl border border-surface-border bg-surface-elevated p-3 text-right">
                          <div className="font-black">{deal.customer_name}</div>
                          <div className="mt-1 text-sm text-muted">{deal.product_name || "ללא מוצר"}</div>
                          <div className="mt-2 text-xl font-black text-brand">
                            {formatCurrency(Number(deal.estimated_value || 0))}
                          </div>
                          <div className="mt-2 text-xs text-muted">
                            👤 {deal.employee_name || "לא משויך"} · {getDaysInStage(deal.updated_at)} ימים בשלב
                          </div>
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button onClick={() => openDealDetails(deal)} className="chip">
                              📋 פרטים
                            </button>
                            {previousStage && (
                              <button onClick={() => void moveDealToStage(deal, previousStage)} className="chip">
                                ⟵ אחורה
                              </button>
                            )}
                            {nextStage && (
                              <button
                                onClick={() =>
                                  nextStage.is_lost
                                    ? askLostReason(deal, nextStage)
                                    : void moveDealToStage(deal, nextStage)
                                }
                                className="chip chip-active"
                              >
                                ⟶ התקדם
                              </button>
                            )}
                            {(stage.name === "closing" || stage.is_won) && !deal.order_id && (
                              <button
                                onClick={() => setConvertDeal(deal)}
                                className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white"
                              >
                                צור הזמנה
                              </button>
                            )}
                            {deal.order_id && (
                              <span className="rounded-xl bg-state-success/10 px-3 py-1.5 text-xs font-bold text-state-success">
                                ✅ הזמנה {deal.order_id}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {lostStage && (
            <div className="mt-5 rounded-2xl border border-surface-border bg-surface-card p-4">
              <button
                onClick={() => setLostOpen((current) => !current)}
                className="flex w-full items-center justify-between text-right"
              >
                <span className="text-xs text-muted">{lostDeals.length} עסקאות</span>
                <span className="font-black" style={{ color: lostStage.color || "#ef4444" }}>
                  {lostOpen ? "▼" : "▶"} {lostStage.name_he}
                </span>
              </button>

              {lostOpen && (
                <div className="mt-4 space-y-3">
                  {lostDeals.length === 0 ? (
                    <div className="text-center text-xs text-muted">אין עסקאות אבודות לפי הסינון</div>
                  ) : (
                    lostDeals.map((deal) => {
                      const fallbackStage = mainStages[mainStages.length - 1] || null;
                      return (
                        <div key={deal.id} className="rounded-2xl border border-surface-border bg-surface-elevated p-3 text-right">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="text-left text-xs text-muted">{timeAgo(deal.updated_at)}</div>
                            <div>
                              <div className="font-black">{deal.customer_name}</div>
                              <div className="text-sm text-muted">{deal.product_name || "ללא מוצר"}</div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted">
                            סיבה: {deal.lost_reason || "לא צוינה"} · {formatCurrency(Number(deal.estimated_value || 0))}
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => openDealDetails(deal)} className="chip">
                              📋 פרטים
                            </button>
                            {fallbackStage && (
                              <button onClick={() => void moveDealToStage(deal, fallbackStage)} className="chip chip-active">
                                החזר לסגירה
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={dealModalOpen}
        onClose={() => {
          setDealModalOpen(false);
          setSelectedDeal(null);
        }}
        title={selectedDeal ? "פרטי עסקה" : "עסקה חדשה"}
        wide
        footer={
          <div className="flex gap-2">
            {selectedDeal && (
              <button
                onClick={() => setDeleteDealId(selectedDeal.id)}
                className="rounded-xl border border-state-error/30 bg-state-error/10 px-4 py-2.5 font-bold text-state-error"
              >
                מחיקה
              </button>
            )}
            <button onClick={() => setDealModalOpen(false)} className="btn-outline flex-1">
              ביטול
            </button>
            <button onClick={() => void persistDeal()} disabled={savingDeal} className="btn-primary flex-1 disabled:opacity-50">
              {savingDeal ? "שומר..." : selectedDeal ? "שמור שינויים" : "צור עסקה"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="שם לקוח" required>
            <input
              className="input"
              value={dealForm.customer_name}
              onChange={(e) => setDealForm((current) => ({ ...current, customer_name: e.target.value }))}
            />
          </FormField>
          <FormField label="טלפון">
            <input
              className="input"
              value={dealForm.customer_phone}
              onChange={(e) => setDealForm((current) => ({ ...current, customer_phone: e.target.value }))}
              dir="ltr"
            />
          </FormField>
          <FormField label="אימייל">
            <input
              className="input"
              value={dealForm.customer_email}
              onChange={(e) => setDealForm((current) => ({ ...current, customer_email: e.target.value }))}
              dir="ltr"
            />
          </FormField>
          <FormField label="שלב">
            <select
              className="input"
              value={dealForm.stage_id}
              onChange={(e) => setDealForm((current) => ({ ...current, stage_id: Number(e.target.value) }))}
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name_he}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="מוצר">
            <select
              className="input"
              value={dealForm.product_id}
              onChange={(e) => {
                const product = products.find((entry) => entry.id === e.target.value);
                setDealForm((current) => ({
                  ...current,
                  product_id: e.target.value,
                  product_name: product ? `${product.brand} ${product.name_ar}` : current.product_name,
                  estimated_value: product && !current.estimated_value ? Number(product.price || 0) : current.estimated_value,
                }));
              }}
            >
              <option value="">בחר מוצר</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.brand} · {product.name_ar}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="שם מוצר ידני">
            <input
              className="input"
              value={dealForm.product_name}
              onChange={(e) => setDealForm((current) => ({ ...current, product_name: e.target.value }))}
              placeholder="למשל Galaxy S24 Ultra"
            />
          </FormField>
          <FormField label="שווי משוער">
            <input
              className="input"
              type="number"
              min={0}
              value={dealForm.estimated_value}
              onChange={(e) => setDealForm((current) => ({ ...current, estimated_value: Number(e.target.value || 0) }))}
              dir="ltr"
            />
          </FormField>
          <FormField label="סיבת אובדן">
            <select
              className="input"
              value={dealForm.lost_reason}
              onChange={(e) => setDealForm((current) => ({ ...current, lost_reason: e.target.value }))}
            >
              <option value="">ללא</option>
              {LOST_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="הערות">
          <textarea
            className="input min-h-[100px] resize-y"
            value={dealForm.notes}
            onChange={(e) => setDealForm((current) => ({ ...current, notes: e.target.value }))}
          />
        </FormField>

        {selectedDeal && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-surface-elevated p-3 text-right">
              <div className="text-xs text-muted">עובד</div>
              <div className="mt-1 font-bold">{selectedDeal.employee_name || "לא משויך"}</div>
            </div>
            <div className="rounded-2xl bg-surface-elevated p-3 text-right">
              <div className="text-xs text-muted">נוצר</div>
              <div className="mt-1 font-bold">{formatDateTime(selectedDeal.created_at)}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!lostMove}
        onClose={() => setLostMove(null)}
        title="סיבת אובדן"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setLostMove(null)} className="btn-outline flex-1">
              ביטול
            </button>
            <button onClick={() => void confirmLostMove()} className="btn-primary flex-1">
              שמור
            </button>
          </div>
        }
      >
        <FormField label="בחר סיבה">
          <select className="input" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
            {LOST_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        {lostReason === "other" && (
          <FormField label="פירוט">
            <input
              className="input"
              value={lostReasonOther}
              onChange={(e) => setLostReasonOther(e.target.value)}
              placeholder="רשום את סיבת האובדן"
            />
          </FormField>
        )}
      </Modal>

      <ManualOrderModal
        open={!!convertDeal}
        onClose={() => setConvertDeal(null)}
        endpoint={convertDeal ? `/api/crm/pipeline/${convertDeal.id}/convert` : "/api/crm/pipeline/convert"}
        title={convertDeal ? `צור הזמנה מתוך ${convertDeal.customer_name}` : "צור הזמנה"}
        submitLabel="צור הזמנה"
        initialValues={convertInitialValues}
        lockSource
        show={show}
        onCreated={(order) => {
          setConvertDeal(null);
          void refreshPipeline();
          show(`✅ הזמנה נוצרה ${order?.id || ""}`.trim());
        }}
      />

      <ConfirmDialog
        open={!!deleteDealId}
        onClose={() => setDeleteDealId(null)}
        onConfirm={() => void deleteDeal()}
        title="למחוק עסקה?"
        message="הפעולה תמחק את העסקה מהפייפליין."
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
