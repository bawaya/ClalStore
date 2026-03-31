"use client";

import { Toggle, EmptyState } from "@/components/admin/shared";
import type { useScreen } from "@/lib/hooks";
import type { Hero } from "@/types/database";

export type BannersSectionEditorProps = {
  heroes: Hero[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (h: Hero) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  scr: ReturnType<typeof useScreen>;
};

export function BannersSectionEditor({ heroes, loading, onAdd, onEdit, onToggle, onDelete, scr }: BannersSectionEditorProps) {
  if (loading) return <div className="text-center py-8 text-muted">⏳</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted" style={{ fontSize: 11 }}>{heroes.length} بنر</span>
        <button onClick={onAdd} className="btn-primary" style={{ fontSize: 12, padding: "8px 16px" }}>
          ➕ بنر جديد
        </button>
      </div>

      {heroes.length === 0 ? (
        <EmptyState icon="🖼️" title="لا يوجد بنرات" sub="أضف بنر أول لعرضه في الكاروسيل" />
      ) : (
        <div className="space-y-1.5">
          {heroes.map((h) => (
            <div key={h.id} className="bg-surface-elevated/50 border border-surface-border rounded-xl flex items-center gap-3 cursor-pointer hover:border-brand/30 transition-all"
              style={{ padding: scr.mobile ? "10px 12px" : "12px 16px" }}
              onClick={() => onEdit(h)}>

              {h.image_url ? (
                <div className="w-16 h-10 bg-surface-bg rounded-lg overflow-hidden flex-shrink-0">
                  <img src={h.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-10 bg-surface-bg rounded-lg flex items-center justify-center flex-shrink-0 text-xl">🖼️</div>
              )}

              <div className="flex-1 text-right min-w-0">
                <div className="font-bold truncate" style={{ fontSize: scr.mobile ? 12 : 14 }}>{h.title_ar}</div>
                <div className="text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  {h.subtitle_ar || "—"} • ترتيب: {h.sort_order}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Toggle value={h.active} onChange={(v) => onToggle(h.id, v)} />
                <button onClick={() => onDelete(h.id)}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center hover:bg-state-error/10">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
