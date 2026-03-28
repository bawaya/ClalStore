"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/i18n";
import { LOYALTY_CONFIG, type TierKey } from "@/lib/loyalty";
import { csrfHeaders } from "@/lib/csrf-client";

interface LoyaltyData {
  points: number;
  lifetime_points: number;
  tier: TierKey;
  tier_label_ar: string;
  tier_label_he: string;
  tier_color: string;
  tier_icon: string;
  tier_multiplier: number;
  points_value: number;
  next_tier: TierKey | null;
  next_tier_label_ar: string | null;
  next_tier_label_he: string | null;
  next_tier_min: number | null;
  points_to_next: number;
  progress_percent: number;
}

interface Transaction {
  id: string;
  type: "earn" | "redeem" | "expire" | "bonus" | "adjust";
  points: number;
  balance_after: number;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

const TX_ICONS: Record<string, string> = {
  earn: "✨",
  redeem: "🎁",
  expire: "⏰",
  bonus: "🎉",
  adjust: "⚙️",
};

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let raf: number;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);

      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        ref.current = value;
      }
    }

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

export function LoyaltyWidget() {
  const { lang, t } = useLang();
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchLoyalty = useCallback(async () => {
    const token = localStorage.getItem("clal_customer_token");
    if (!token) return;

    try {
      const res = await fetch("/api/customer/loyalty", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLoyalty(data.loyalty);
        setTransactions(data.transactions || []);
      }
    } catch { /* network error */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLoyalty(); }, [fetchLoyalty]);

  const handleRedeem = async () => {
    setShowConfirm(false);
    const pts = parseInt(redeemAmount);
    if (!pts || pts <= 0) return;

    setRedeeming(true);
    setRedeemMsg(null);

    const token = localStorage.getItem("clal_customer_token");
    if (!token) return;

    try {
      const res = await fetch("/api/customer/loyalty", {
        method: "POST",
        headers: csrfHeaders({ Authorization: `Bearer ${token}` }),
        body: JSON.stringify({ action: "redeem", points: pts }),
      });
      const data = await res.json();

      if (data.success) {
        setRedeemMsg({ type: "success", text: t("account.redeemSuccess") });
        setRedeemAmount("");
        fetchLoyalty();
      } else if (data.error === "not_enough_points") {
        setRedeemMsg({ type: "error", text: t("account.notEnoughPoints") });
      } else {
        setRedeemMsg({ type: "error", text: t("account.redeemError") });
      }
    } catch {
      setRedeemMsg({ type: "error", text: t("account.redeemError") });
    }
    setRedeeming(false);
    setTimeout(() => setRedeemMsg(null), 4000);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
        <div className="h-48 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!loyalty) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-8 text-center">
        <div className="text-5xl mb-3">🏆</div>
        <p className="text-zinc-400">{t("account.loyalty")}</p>
        <p className="text-sm text-zinc-600 mt-1">{t("account.earnRate")}</p>
      </div>
    );
  }

  const tierConf = LOYALTY_CONFIG.tiers[loyalty.tier];
  const redeemPts = parseInt(redeemAmount) || 0;
  const redeemValue = redeemPts > 0 ? (redeemPts * LOYALTY_CONFIG.shekelPerPoint) : 0;

  return (
    <div className="space-y-4">
      {/* ── Points Balance & Tier ── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-5"
        style={{
          background: `linear-gradient(135deg, ${tierConf.color}08 0%, ${tierConf.color}03 100%)`,
        }}
      >
        <div
          className="absolute -top-16 -end-16 w-48 h-48 rounded-full opacity-[0.06] blur-[60px]"
          style={{ background: tierConf.color }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-1">
              {t("account.yourPoints")}
            </p>
            <div className="text-4xl font-black text-white tracking-tight">
              <AnimatedNumber value={loyalty.points} />
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {t("account.pointsValue")}:{" "}
              <span className="font-bold text-zinc-300">
                ₪{loyalty.points_value.toFixed(2)}
              </span>
            </p>
          </div>

          <div className="text-center shrink-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border"
              style={{
                borderColor: tierConf.color + "30",
                background: tierConf.color + "10",
              }}
            >
              {tierConf.icon}
            </div>
            <p className="text-xs font-bold mt-1.5" style={{ color: tierConf.color }}>
              {lang === "he" ? loyalty.tier_label_he : loyalty.tier_label_ar}
            </p>
          </div>
        </div>

        {loyalty.tier_multiplier > 1 && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ background: tierConf.color + "15", color: tierConf.color }}
          >
            ×{loyalty.tier_multiplier} {t("account.multiplier")}
          </div>
        )}

        <p className="text-[11px] text-zinc-600 mt-2">{t("account.earnRate")}</p>
      </div>

      {/* ── Tier Progress ── */}
      {loyalty.next_tier && (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-500">
              {t("account.nextTier")}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">
                {LOYALTY_CONFIG.tiers[loyalty.next_tier].icon}
              </span>
              <span className="text-xs font-bold" style={{ color: LOYALTY_CONFIG.tiers[loyalty.next_tier].color }}>
                {lang === "he" ? loyalty.next_tier_label_he : loyalty.next_tier_label_ar}
              </span>
            </div>
          </div>

          <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="absolute inset-y-0 start-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${loyalty.progress_percent}%`,
                background: `linear-gradient(90deg, ${tierConf.color}, ${LOYALTY_CONFIG.tiers[loyalty.next_tier].color})`,
              }}
            />
          </div>

          <p className="text-xs text-zinc-500 mt-2">
            <span className="font-bold text-zinc-300">{loyalty.points_to_next.toLocaleString()}</span>{" "}
            {t("account.pointsToNext")}
          </p>
        </div>
      )}

      {/* ── Redeem Section ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4">
        <p className="text-sm font-bold text-white mb-1">{t("account.redeemPoints")}</p>
        <p className="text-xs text-zinc-500 mb-3">{t("account.redeemDesc")}</p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min={1}
              max={loyalty.points}
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder={`${t("account.points")} (${lang === "he" ? "מקסימום" : "الحد الأقصى"}: ${loyalty.points.toLocaleString()})`}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-zinc-600 bg-white/[0.04] border border-white/[0.08] focus:border-[#c41040]/50 focus:ring-1 focus:ring-[#c41040]/20 outline-none transition-all duration-200"
              dir="ltr"
            />
            {redeemPts > 0 && (
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                = ₪{redeemValue.toFixed(2)}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (redeemPts <= 0 || redeemPts > loyalty.points) return;
              setShowConfirm(true);
            }}
            disabled={redeeming || redeemPts <= 0 || redeemPts > loyalty.points}
            className="shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: "linear-gradient(135deg, #c41040, #a00d34)" }}
          >
            {redeeming ? "..." : t("account.redeem")}
          </button>
        </div>

        {redeemMsg && (
          <p className={`mt-2 text-sm font-medium ${
            redeemMsg.type === "success" ? "text-emerald-400" : "text-red-400"
          }`}>
            {redeemMsg.text}
          </p>
        )}
      </div>

      {/* ── Confirm Dialog ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111114] p-6 text-center">
            <div className="text-4xl mb-3">🎁</div>
            <p className="text-lg font-bold text-white mb-1">
              {t("account.redeemPoints")}
            </p>
            <p className="text-sm text-zinc-400 mb-4">
              {redeemPts.toLocaleString()} {t("account.points")} = ₪{redeemValue.toFixed(2)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-zinc-400 bg-white/[0.05] hover:bg-white/[0.08] transition-colors duration-200"
              >
                {lang === "he" ? "ביטול" : "إلغاء"}
              </button>
              <button
                onClick={handleRedeem}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #c41040, #a00d34)" }}
              >
                {t("account.redeem")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transactions History ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-bold text-white">{t("account.transactions")}</p>
        </div>

        {transactions.length === 0 ? (
          <div className="px-4 pb-6 text-center">
            <p className="text-sm text-zinc-600 mt-2">{t("account.noTransactions")}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {transactions.map((tx) => {
              const isPositive = tx.points > 0;
              const date = new Date(tx.created_at).toLocaleDateString(
                lang === "he" ? "he-IL" : "ar-EG",
                { day: "numeric", month: "short" }
              );

              let label: string;
              if (tx.type === "earn") label = tx.order_id ? `${t("account.earnedFrom")} #${tx.order_id.slice(0, 8).toUpperCase()}` : t("account.bonus");
              else if (tx.type === "redeem") label = t("account.redeemed");
              else if (tx.type === "bonus") label = t("account.bonus");
              else label = tx.description || tx.type;

              return (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-sm">
                      {TX_ICONS[tx.type] || "📋"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{label}</p>
                      <p className="text-[11px] text-zinc-600">{date}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${
                    isPositive ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {isPositive ? "+" : ""}{tx.points.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
