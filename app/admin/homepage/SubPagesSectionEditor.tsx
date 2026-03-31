"use client";

import { Toggle, EmptyState } from "@/components/admin/shared";
import type { useScreen } from "@/lib/hooks";
import type { SubPage } from "@/types/database";

export type SubPagesSectionEditorProps = {
  pages: SubPage[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (p: SubPage) => void;
  onToggle: (id: string, visible: boolean) => void;
  onDelete: (id: string) => void;
  scr: ReturnType<typeof useScreen>;
};

export function SubPagesSectionEditor({ pages, loading, onAdd, onEdit, onToggle, onDelete, scr }: SubPagesSectionEditorProps) {
  if (loading) return <div className="text-center py-8 text-muted">⏳</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted" style={{ fontSize: 11 }}>{pages.length} صفحات فرعية</span>
        <button onClick={onAdd} className="btn-primary" style={{ fontSize: 12, padding: "8px 16px" }}>
          ➕ صفحة جديدة
        </button>
      </div>

      {pages.length === 0 ? (
        <EmptyState icon="📄" title="لا يوجد صفحات فرعية" sub="أنشئ صفحة فرعية لعرض محتوى إضافي في الموقع" />
      ) : (
        <div className="space-y-1.5">
          {pages.map((p) => (
            <div key={p.id} className="bg-surface-elevated/50 border border-surface-border rounded-xl flex items-center gap-3 cursor-pointer hover:border-brand/30 transition-all"
              style={{ padding: scr.mobile ? "10px 12px" : "12px 16px" }}
              onClick={() => onEdit(p)}>

              {p.image_url ? (
                <div className="w-14 h-10 bg-surface-bg rounded-lg overflow-hidden flex-shrink-0">
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-10 bg-surface-bg rounded-lg flex items-center justify-center flex-shrink-0 text-lg">📄</div>
              )}

              <div className="flex-1 text-right min-w-0">
                <div className="font-bold truncate" style={{ fontSize: scr.mobile ? 12 : 14 }}>{p.title_ar}</div>
                <div className="text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  /{p.slug} • ترتيب: {p.sort_order}
                  {p.is_visible ? <span className="text-state-success mr-1">● مرئي</span> : <span className="text-state-error mr-1">● مخفي</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Toggle value={p.is_visible} onChange={(v) => onToggle(p.id, v)} />
                <button onClick={() => onDelete(p.id)}
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
