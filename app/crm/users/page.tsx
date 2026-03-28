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
  details?: Record<string, unknown>;
  created_at: string;
}

type NewUserForm = {
  name: string;
  email: string;
  phone: string;
  role: string;
};

export default function UsersPage() {
  const scr = useScreen();
  const [tab, setTab] = useState<"team" | "audit">("team");
  const [users, setUsers] = useState<UserData[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState("");

  // New user form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<{ tempPassword: string; name: string; notifications: { channel: string; success: boolean }[] } | null>(null);
  const [form, setForm] = useState<NewUserForm>({ name: "", email: "", phone: "", role: "viewer" });

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/crm/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "خطأ في جلب المستخدمين");
      }
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

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
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "خطأ";
          setError(message);
        } finally {
          setLoadingAudit(false);
        }
      })();
    }
  }, [tab, audit.length]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setCreateSuccess(null);

    try {
      const res = await fetch("/api/crm/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "فشل في إنشاء المستخدم");
      }

      setCreateSuccess({
        tempPassword: data.tempPassword,
        name: form.name,
        notifications: data.notifications || [],
      });
      setForm({ name: "", email: "", phone: "", role: "viewer" });
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ غير متوقع";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟`)) return;

    try {
      const res = await fetch("/api/crm/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في حذف المستخدم");
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ";
      setError(message);
    }
  };

  const handleToggleStatus = async (user: UserData) => {
    const newStatus = user.status === "active" ? "suspended" : "active";
    try {
      const res = await fetch("/api/crm/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في تحديث الحالة");
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ";
      setError(message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/crm/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في تحديث الصلاحية");
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ";
      setError(message);
    }
  };

  if (loading) return <div className="text-center py-20 text-muted">جاري التحميل...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>الفريق</h1>
        <button
          onClick={() => { setShowCreateForm(!showCreateForm); setCreateSuccess(null); setError(""); }}
          className="btn-primary text-xs"
        >
          {showCreateForm ? "إلغاء" : "+ إضافة عضو"}
        </button>
      </div>

      {error && <div className="text-center py-2 text-red-400 text-xs mb-2 bg-red-500/10 rounded-xl px-3">{error}</div>}

      {/* Create User Form */}
      {showCreateForm && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold text-sm mb-3 text-right">إضافة عضو جديد</h3>

          {createSuccess ? (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-xs text-right">
                تم إنشاء حساب <strong>{createSuccess.name}</strong> بنجاح!
              </div>

              <div className="bg-surface-elevated rounded-xl p-3 text-right space-y-2">
                <div className="text-xs text-muted">كلمة المرور المؤقتة:</div>
                <div className="font-mono text-sm bg-amber-500/10 text-amber-400 rounded-lg px-3 py-2 text-center select-all" dir="ltr">
                  {createSuccess.tempPassword}
                </div>
                <div className="text-[10px] text-muted">
                  صلاحية 24 ساعة — سيُطلب تغييرها عند أول دخول
                </div>
              </div>

              <div className="space-y-1">
                {createSuccess.notifications.map((n, i) => (
                  <div key={i} className={`text-[10px] ${n.success ? "text-green-400" : "text-red-400"}`}>
                    {n.success ? "✓" : "✗"} {n.channel === "email" ? "البريد الإلكتروني" : n.channel === "whatsapp" ? "واتساب" : n.channel}
                    {n.success ? " — تم الإرسال" : " — فشل الإرسال"}
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setCreateSuccess(null); setShowCreateForm(false); }}
                className="btn-primary w-full text-xs"
              >
                تم
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
                <div>
                  <label className="block text-[#71717a] text-[10px] font-semibold mb-1 text-right">الاسم الكامل *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input text-right"
                    placeholder="محمد أحمد"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#71717a] text-[10px] font-semibold mb-1 text-right">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input"
                    placeholder="user@clalmobile.co.il"
                    required
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[#71717a] text-[10px] font-semibold mb-1 text-right">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input"
                    placeholder="+972501234567"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[#71717a] text-[10px] font-semibold mb-1 text-right">الصلاحية *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="input text-right"
                  >
                    {Object.entries(USER_ROLE).map(([key, val]) => (
                      <option key={key} value={key}>{val.icon} {val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-surface-elevated rounded-xl p-2.5 text-[10px] text-muted text-right">
                سيتم إنشاء كلمة مرور مؤقتة تلقائياً وإرسالها للمستخدم عبر البريد الإلكتروني (والواتساب إن وُجد رقم هاتف).
                سيُطلب من المستخدم تغيير كلمة المرور عند أول دخول.
              </div>

              <button
                type="submit"
                disabled={creating || !form.name || !form.email}
                className="btn-primary w-full text-xs disabled:opacity-50"
              >
                {creating ? "جاري الإنشاء..." : "إنشاء الحساب"}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="flex gap-1.5 mb-4">
        <button onClick={() => setTab("team")} className={`chip ${tab === "team" ? "chip-active" : ""}`}>الأعضاء ({users.length})</button>
        <button onClick={() => setTab("audit")} className={`chip ${tab === "audit" ? "chip-active" : ""}`}>سجل النشاط</button>
      </div>

      {tab === "team" && (
        <>
          {/* Roles legend */}
          <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
            <div className="font-bold text-right mb-2 text-xs">الصلاحيات</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
              {Object.entries(USER_ROLE).map(([k, v]) => (
                <div key={k} className="bg-surface-elevated rounded-lg px-2.5 py-1.5 text-right">
                  <div className="font-bold text-xs" style={{ color: v.color }}>{v.icon} {v.label}</div>
                  <div className="text-muted text-[9px]">{([...v.permissions] as string[]).slice(0, 3).join(", ")}{([...v.permissions] as string[]).length > 3 ? "..." : ""}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Users list */}
          {users.length === 0 ? (
            <div className="text-center py-12 text-dim">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-sm">لا يوجد أعضاء فريق بعد</div>
              <div className="text-muted text-xs mt-1">اضغط "إضافة عضو" لإنشاء مستخدم جديد</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {users.map((u) => {
                const role = USER_ROLE[u.role as keyof typeof USER_ROLE];
                return (
                  <div key={u.id} className="card flex items-center justify-between" style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className="text-[9px] px-2 py-0.5 rounded-md font-bold cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: u.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: u.status === "active" ? "#22c55e" : "#ef4444" }}
                        title={u.status === "active" ? "اضغط لتعطيل" : "اضغط لتفعيل"}
                      >
                        {u.status === "active" ? "نشط" : "معطّل"}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="text-[9px] px-1.5 py-0.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                        title="حذف المستخدم"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex-1 text-right mr-2">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>{u.name}</span>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="badge text-[9px] border-0 bg-transparent cursor-pointer"
                          style={{ color: role?.color }}
                        >
                          {Object.entries(USER_ROLE).map(([key, val]) => (
                            <option key={key} value={key}>{val.icon} {val.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                        {u.email}{u.phone ? ` • ${u.phone}` : ""} • طلبات: {u.orders_count} • آخر دخول: {u.last_login_at ? timeAgo(u.last_login_at) : "لم يسجل"}
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
        </>
      )}

      {tab === "audit" && (
        <div className="space-y-1">
          {loadingAudit ? (
            <div className="text-center py-12 text-muted text-sm">جاري التحميل...</div>
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
                  {a.entity_type === "order" ? "📦" : a.entity_type === "product" ? "📱" : a.entity_type === "customer" ? "👤" : a.entity_type === "user" ? "🔑" : a.entity_type === "bot_conversation" ? "💬" : "📋"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
