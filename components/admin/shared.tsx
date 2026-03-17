"use client";

import { useScreen } from "@/lib/hooks";

// ===== Modal =====
export function Modal({
  open, onClose, title, children, wide, footer,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode;
}) {
  const scr = useScreen();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-surface-card border border-surface-border rounded-2xl flex flex-col max-h-[90vh]"
        style={{
          width: scr.mobile ? "95%" : wide ? 700 : 500,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0" style={{ padding: scr.mobile ? "12px 16px" : "16px 24px" }}>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-surface-border bg-transparent text-muted cursor-pointer flex items-center justify-center text-sm">✕</button>
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 14 : 18 }}>{title}</h2>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0" style={{ padding: scr.mobile ? "0 16px 16px" : "0 24px 24px" }}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-surface-border" style={{ padding: scr.mobile ? "12px 16px" : "16px 24px" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Stat Card =====
export function StatCard({
  icon, label, value, sub, color,
}: {
  icon: string; label: string; value: string | number; sub?: string; color?: string;
}) {
  const scr = useScreen();
  return (
    <div className="card" style={{ padding: scr.mobile ? 12 : 18 }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>{label}</span>
        <span>{icon}</span>
      </div>
      <div className="font-black" style={{ fontSize: scr.mobile ? 20 : 28, color: color || "#fafafa" }}>
        {value}
      </div>
      {sub && <div className="text-muted mt-0.5" style={{ fontSize: scr.mobile ? 8 : 10 }}>{sub}</div>}
    </div>
  );
}

// ===== Empty State =====
export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="text-center py-12 text-dim">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="text-sm font-bold">{title}</div>
      {sub && <div className="text-xs mt-1 text-muted">{sub}</div>}
    </div>
  );
}

// ===== Toggle Switch =====
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="rounded-full transition-all cursor-pointer border-0"
      style={{
        width: 38, height: 20,
        background: value ? "#c41040" : "#3f3f46",
        padding: 2,
      }}
    >
      <div
        className="w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: value ? "translateX(-18px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ===== Page Header =====
export function PageHeader({
  title, count, onAdd, addLabel,
}: {
  title: string; count?: number; onAdd?: () => void; addLabel?: string;
}) {
  const scr = useScreen();
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>{title}</h1>
        {count !== undefined && (
          <span className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>{count} عنصر</span>
        )}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="btn-primary" style={{ fontSize: scr.mobile ? 10 : 12, padding: scr.mobile ? "8px 14px" : "10px 20px" }}>
          + {addLabel || "إضافة"}
        </button>
      )}
    </div>
  );
}

// ===== Form Field =====
export function FormField({
  label, error, children, required,
}: {
  label: string; error?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="block text-muted text-[10px] desktop:text-xs font-semibold mb-1">
        {label} {required && <span className="text-brand">*</span>}
      </label>
      {children}
      {error && <div className="text-[9px] text-state-error mt-0.5">⚠️ {error}</div>}
    </div>
  );
}

// ===== Confirm Dialog =====
export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-black text-center mb-2">{title}</h3>
        <p className="text-muted text-sm text-center mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 px-5 py-2.5 rounded-xl bg-state-error text-white font-bold cursor-pointer border-0">حذف</button>
        </div>
      </div>
    </div>
  );
}
