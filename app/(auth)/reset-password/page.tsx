"use client";

/**
 * /reset-password — target of the email recovery link.
 *
 * Supabase sends the user here with a temporary recovery session attached
 * to the URL (as a hash fragment: #access_token=...&type=recovery).
 * @supabase/ssr auto-parses the hash on client init and installs a short-
 * lived session that can only call auth.updateUser — exactly what we need.
 *
 * Flow:
 *   1. Mount → the supabase browser client reads the hash and creates a
 *      recovery session (detectSessionInUrl: true, default)
 *   2. We listen for PASSWORD_RECOVERY auth event as a secondary check
 *   3. User enters a new password (same strength rules as /change-password)
 *   4. supabase.auth.updateUser({ password }) — session is now full
 *   5. Redirect to /login with a success flash
 *
 * Expired / invalid token → we detect the absence of a recovery session
 * and show an error + link back to /forgot-password.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [noSession, setNoSession] = useState(false);

  // Wait for Supabase to parse the recovery token from the URL hash and
  // install a session. Listen for the PASSWORD_RECOVERY event as a
  // secondary signal; fall back to a delayed session check.
  useEffect(() => {
    let cancelled = false;
    let sub: { subscription: { unsubscribe: () => void } } | null = null;

    (async () => {
      try {
        const { getSupabase } = await import("@/lib/supabase");
        const supabase = getSupabase();
        if (!supabase) {
          if (!cancelled) {
            setError("خدمة المصادقة غير متوفرة");
            setReady(true);
          }
          return;
        }

        // Subscribe to auth events (PASSWORD_RECOVERY fires when the URL
        // hash is successfully consumed).
        sub = supabase.auth.onAuthStateChange((event: string) => {
          if (event === "PASSWORD_RECOVERY" && !cancelled) {
            setReady(true);
            setNoSession(false);
          }
        });

        // Give the Supabase client a microtask + macrotask to parse the URL
        // hash (detectSessionInUrl: true). A short handshake is enough — the
        // parsing is synchronous once the script picks up the hash.
        await new Promise((r) => setTimeout(r, 50));
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!data.session) {
          setNoSession(true);
          setReady(true);
        } else {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setError("خطأ في التهيئة");
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Password strength indicators — same rules as /change-password
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
      const { getSupabase } = await import("@/lib/supabase");
      const supabase = getSupabase();
      if (!supabase) {
        setError("خدمة المصادقة غير متوفرة");
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updErr) {
        setError(
          updErr.message?.toLowerCase().includes("expired")
            ? "الرابط انتهت صلاحيته — اطلب رابط جديد"
            : updErr.message || "فشل في تعيين كلمة المرور",
        );
        return;
      }

      // Redirect to login with a success flash
      window.location.href = "/login?reset=success";
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg">
        <div className="text-[#71717a] text-sm">جاري التحقق...</div>
      </div>
    );
  }

  if (noSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-bg">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6 flex flex-col items-center">
            <Logo size={48} showText label="ClalMobile" />
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm text-center space-y-2">
            <div className="font-bold">الرابط غير صالح أو انتهت صلاحيته</div>
            <p className="text-xs text-red-300/90">
              روابط إعادة التعيين صالحة لفترة محدودة. اطلب رابطاً جديداً.
            </p>
          </div>
          <div className="mt-4 text-center space-y-2">
            <Link
              href="/forgot-password"
              className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-400"
            >
              طلب رابط جديد
            </Link>
            <div>
              <Link
                href="/login"
                className="text-[#71717a] text-xs hover:text-[#a1a1aa] underline underline-offset-2"
              >
                العودة لتسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 flex flex-col items-center">
          <Logo size={48} showText label="ClalMobile" subtitle="تعيين كلمة مرور جديدة" />
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
              autoFocus
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

          {/* Password strength checklist — same spec as /change-password */}
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
            {loading ? "جاري الحفظ..." : "تعيين كلمة المرور"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-[#71717a] text-xs hover:text-[#a1a1aa] underline underline-offset-2"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
