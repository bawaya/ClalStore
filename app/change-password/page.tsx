"use client";

import { useState, useEffect } from "react";
import { Logo } from "@/components/shared/Logo";
import { csrfHeaders } from "@/lib/csrf-client";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // Verify user is authenticated and must change password
  useEffect(() => {
    async function checkAuth() {
      try {
        const { getSupabase } = await import("@/lib/supabase");
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const { data: profile } = await supabase
          .from("users")
          .select("must_change_password")
          .eq("auth_id", user.id)
          .single();

        if (!profile?.must_change_password) {
          // User doesn't need to change password, redirect to dashboard
          window.location.href = "/crm";
          return;
        }
      } catch {
        window.location.href = "/login";
        return;
      }
      setChecking(false);
    }
    checkAuth();
  }, []);

  // Password strength indicators
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "فشل في تغيير كلمة المرور");
        return;
      }

      // Success — redirect to dashboard
      window.location.href = "/crm";
    } catch {
      setError("خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg">
        <div className="text-[#71717a] text-sm">جاري التحقق...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-bg">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6 flex flex-col items-center">
          <Logo size={48} showText label="ClalMobile" />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-xs text-center mb-4">
          يجب تغيير كلمة المرور المؤقتة قبل الدخول للنظام
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#71717a] text-xs font-semibold mb-1">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              dir="ltr"
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-[#71717a] text-xs font-semibold mb-1">
              تأكيد كلمة المرور
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              dir="ltr"
              minLength={8}
            />
          </div>

          {/* Password strength checklist */}
          <div className="space-y-1 text-xs">
            <div className={hasMinLength ? "text-green-400" : "text-[#52525b]"}>
              {hasMinLength ? "✓" : "○"} 8 أحرف على الأقل
            </div>
            <div className={hasUppercase ? "text-green-400" : "text-[#52525b]"}>
              {hasUppercase ? "✓" : "○"} حرف كبير واحد على الأقل (A-Z)
            </div>
            <div className={hasNumber ? "text-green-400" : "text-[#52525b]"}>
              {hasNumber ? "✓" : "○"} رقم واحد على الأقل (0-9)
            </div>
            <div className={passwordsMatch ? "text-green-400" : "text-[#52525b]"}>
              {passwordsMatch ? "✓" : "○"} كلمات المرور متطابقة
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
          </button>
        </form>
      </div>
    </div>
  );
}
