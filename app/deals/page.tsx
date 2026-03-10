"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { Navbar, Footer } from "@/components/website/sections";

interface Deal {
  id: string;
  title_ar: string;
  title_he: string;
  description_ar?: string;
  description_he?: string;
  product_id?: string;
  deal_type: string;
  discount_percent: number;
  discount_amount: number;
  original_price?: number;
  deal_price?: number;
  image_url?: string;
  badge_text_ar?: string;
  badge_text_he?: string;
  starts_at: string;
  ends_at?: string;
  max_quantity: number;
  sold_count: number;
  active: boolean;
}

function Countdown({ endsAt, t }: { endsAt: string; t: (k: string) => string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const end = new Date(endsAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft(t("store2.dealExpired"));
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}ي ${hours}س ${minutes}د`);
      } else {
        setTimeLeft(`${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt, t]);

  return (
    <div className="glass-elevated rounded-lg px-3 py-1.5 font-mono font-bold text-center" style={{ color: "#ef4444" }}>
      ⏰ {timeLeft}
    </div>
  );
}

function DealCard({ deal, lang, mobile, t }: { deal: Deal; lang: string; mobile: boolean; t: (k: string) => string }) {
  const title = lang === "he" ? (deal.title_he || deal.title_ar) : deal.title_ar;
  const desc = lang === "he" ? (deal.description_he || deal.description_ar) : deal.description_ar;
  const badge = lang === "he" ? (deal.badge_text_he || deal.badge_text_ar) : deal.badge_text_ar;

  const progress = deal.max_quantity > 0
    ? Math.min((deal.sold_count / deal.max_quantity) * 100, 100)
    : 0;

  return (
    <div className="glass-card overflow-hidden group hover:scale-[1.01] transition-transform" style={{ borderColor: "rgba(196,16,64,0.3)" }}>
      {/* Badge */}
      {badge && (
        <div className="absolute top-2 right-2 z-10 bg-brand text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
          {badge}
        </div>
      )}

      {/* Image */}
      <div className="bg-surface-elevated flex items-center justify-center relative" style={{ height: mobile ? 160 : 220 }}>
        {deal.image_url ? (
          <img src={deal.image_url} alt={title} className="max-h-[85%] max-w-[85%] object-contain" />
        ) : (
          <span style={{ fontSize: 48 }}>🔥</span>
        )}

        {deal.discount_percent > 0 && (
          <div className="absolute top-2 left-2 bg-state-error text-white font-black rounded-full w-12 h-12 flex items-center justify-center text-sm shadow-lg">
            -{deal.discount_percent}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="font-extrabold text-right" style={{ fontSize: mobile ? 13 : 16 }}>{title}</h3>
        {desc && <p className="text-muted text-right text-xs line-clamp-2">{desc}</p>}

        {deal.deal_price !== undefined && deal.deal_price !== null && (
          <div className="flex items-center gap-2 justify-end">
            {deal.original_price && (
              <span className="text-muted line-through text-xs">₪{deal.original_price}</span>
            )}
            <span className="text-brand font-black" style={{ fontSize: mobile ? 18 : 22 }}>
              ₪{deal.deal_price}
            </span>
          </div>
        )}

        {deal.ends_at && <Countdown endsAt={deal.ends_at} t={t} />}

        {deal.max_quantity > 0 && (
          <div>
            <div className="flex justify-between text-[9px] text-muted mb-1">
              <span>{t("store2.remaining")} {deal.max_quantity - deal.sold_count}</span>
              <span>{t("store2.sold")} {deal.sold_count} {t("store2.of")} {deal.max_quantity}</span>
            </div>
            <div className="h-1.5 bg-glass-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: progress > 80 ? "#ef4444" : "#c41040" }}
              />
            </div>
          </div>
        )}

        {deal.product_id ? (
          <Link
            href={`/store/product/${deal.product_id}`}
            className="btn-primary w-full text-center text-xs py-2.5 rounded-xl font-bold block"
          >
            🛒 {t("store2.orderNow")}
          </Link>
        ) : (
          <Link
            href="/store"
            className="btn-primary w-full text-center text-xs py-2.5 rounded-xl font-bold block"
          >
            🛒 {t("store2.shopNow")}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const scr = useScreen();
  const { t, lang } = useLang();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/deals");
        const json = await res.json();
        setDeals(json.deals || []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />

      <div className="max-w-[900px] mx-auto" style={{ paddingTop: scr.mobile ? 80 : 100, paddingInline: scr.mobile ? 14 : 28, paddingBottom: scr.mobile ? 30 : 40 }}>
        <div className="text-center mb-6">
          <h1 className="font-black" style={{ fontSize: scr.mobile ? 22 : 32 }}>
            🔥 {t("store2.dealsTitle")}
          </h1>
          <p className="text-muted mt-1" style={{ fontSize: scr.mobile ? 11 : 14 }}>
            {t("store2.dealsSubtitle")}
          </p>
        </div>

        {loading && (
          <div className="text-center py-20 text-muted">{t("common.loading")}</div>
        )}

        {!loading && deals.length === 0 && (
          <div className="text-center py-20">
            <div style={{ fontSize: 48 }}>🏷️</div>
            <p className="text-muted mt-2">{t("store2.noDeals")}</p>
            <Link href="/store" className="btn-primary inline-block mt-3 text-sm px-6 py-2 rounded-xl">
              {t("store2.shopProducts")}
            </Link>
          </div>
        )}

        {!loading && deals.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} lang={lang} mobile={scr.mobile} t={t} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
