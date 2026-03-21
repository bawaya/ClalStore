"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useScreen } from "@/lib/hooks";
import { USER_ROLE } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: "active" | "suspended";
  last_login_at?: string;
  created_at: string;
  orders_count: number;
  last_activity?: { action: string; created_at: string } | null;
}

interface AuditEntry {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

export default function UsersPage() {
  const scr = useScreen();
  const [tab, setTab] = useState<"team" | "audit">("team");
  const [users, setUsers] = useState<UserData[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/crm/users");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "خطأ في جلب المستخدمين");
        }
        const json = await res.json();
        setUsers(json.data || []);
      } catch (err: any) {
        setError(err.message || "خطأ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (tab === "audit" && audit.length === 0) {
      setLoadingAudit(true);
      (async () => {
        try {
          const res = await fetch("/api/crm/users?audit=true&limit=100");
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "خطأ في جلب سجل النشاط");
          }
          const json = await res.json();
          setAudit(json.data || []);
        } catch (err: any) {
          setError(err.message || "خطأ");
        } finally {
          setLoadingAudit(false);
        }
      })();
    }
  }, [tab, audit.length]);

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <h1 className="font-black mb-3" style={{ fontSize: scr.mobile ? 16 : 22 }}>🔑 الفريق</h1>

      {error && <div className="text-center py-4 text-red-400 text-sm mb-2">⚠️ {error}</div>}

      <div className="flex gap-1.5 mb-4">
        <button onClick={() => setTab("team")} className={`chip ${tab === "team" ? "chip-active" : ""}`}>👥 الأعضاء ({users.length})</button>
        <button onClick={() => setTab("audit")} className={`chip ${tab === "audit" ? "chip-active" : ""}`}>📋 سجل النشاط</button>
      </div>

      {tab === "team" && (
        <>
          {/* Roles legend */}
          <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
            <div className="font-bold text-right mb-2 text-xs">🔐 الصلاحيات</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
              {Object.entries(USER_ROLE).map(([k, v]) => (
                <div key={k} className="bg-surface-elevated rounded-lg px-2.5 py-1.5 text-right">
                  <div className="font-bold text-xs" style={{ color: v.color }}>{v.icon} {v.label}</div>
                  <div className="text-muted text-[9px]">{([...v.permissions] as string[]).slice(0, 3).join("، ")}{([...v.permissions] as string[]).length > 3 ? "..." : ""}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Users list */}
          {users.length === 0 ? (
            <div className="text-center py-12 text-dim">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-sm">لا يوجد أعضاء فريق بعد</div>
              <div className="text-muted text-xs mt-1">أضف مستخدمين من Supabase Auth Dashboard</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {users.map((u) => {
                const role = USER_ROLE[u.role as keyof typeof USER_ROLE];
                return (
                  <div key={u.id} className="card flex items-center justify-between" style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-md font-bold"
                        style={{ background: u.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: u.status === "active" ? "#22c55e" : "#ef4444" }}>
                        {u.status === "active" ? "نشط" : "معطّل"}
                      </span>
                    </div>
                    <div className="flex-1 text-right mr-2">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>{u.name}</span>
                        {role && <span className="badge" style={{ background: `${role.color}15`, color: role.color }}>{role.icon} {role.label}</span>}
                      </div>
                      <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                        {u.email} • طلبات: {u.orders_count} • آخر دخول: {u.last_login_at ? timeAgo(u.last_login_at) : "لم يسجل"}
                      </div>
                      {u.last_activity && (
                        <div className="text-dim" style={{ fontSize: scr.mobile ? 8 : 9 }}>
                          آخر نشاط: {u.last_activity.action} • {timeAgo(u.last_activity.created_at)}
                        </div>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center font-bold text-sm flex-shrink-0 ml-2"
                      style={{ color: role?.color }}>
                      {u.name.charAt(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-state-info/10 rounded-xl p-3 mt-3 text-state-info text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>
            💡 إدارة المستخدمين تتم من Supabase Auth Dashboard. الأدوار تُعيَّن من جدول users.
          </div>
        </>
      )}

      {tab === "audit" && (
        <div className="space-y-1">
          {loadingAudit ? (
            <div className="text-center py-12 text-muted text-sm">⏳ جاري التحميل...</div>
          ) : audit.length === 0 ? (
            <div className="text-center py-12 text-dim"><div className="text-3xl mb-2">📋</div><div className="text-sm">لا يوجد سجلات بعد</div><div className="text-muted text-xs mt-1">ستظهر هنا عند إجراء أي عملية</div></div>
          ) : (
            audit.map((a) => (
              <div key={a.id} className="flex items-center gap-2 bg-surface-elevated rounded-xl" style={{ padding: scr.mobile ? "8px 10px" : "10px 14px" }}>
                <span className="text-muted text-[10px] flex-shrink-0 w-16 text-left">{timeAgo(a.created_at)}</span>
                <div className="flex-1 text-right">
                  <span className="text-sm">{a.action}</span>
                  <span className="text-muted text-[10px] mr-1.5">{a.user_name}</span>
                </div>
                <span className="text-base flex-shrink-0">
                  {a.entity_type === "order" ? "📦" : a.entity_type === "product" ? "📱" : a.entity_type === "customer" ? "👤" : a.entity_type === "bot_conversation" ? "💬" : "📋"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
