"use client";

export function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving} className="btn-primary disabled:opacity-60" style={{ fontSize: 13, padding: "10px 28px" }}>
      {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
    </button>
  );
}
