"use client";

import { useState } from "react";
import { Logo } from "@/components/shared/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { signIn } = await import("@/lib/auth");
      const data = await signIn(email, password);

      // Check if user must change password
      if (data?.user) {
        const { getSupabase } = await import("@/lib/supabase");
        const supabase = getSupabase();
        const { data: profile } = await supabase
          .from("users")
          .select("must_change_password, temp_password_expires_at")
          .eq("auth_id", data.user.id)
          .single();

        if (profile?.must_change_password) {
          // Check if temp password has expired
          if (profile.temp_password_expires_at) {
            const expiresAt = new Date(profile.temp_password_expires_at);
            if (expiresAt < new Date()) {
              setError("كلمة المرور المؤقتة انتهت صلاحيتها. تواصل مع المدير لإعادة تعيينها.");
              const { signOut } = await import("@/lib/auth");
              await signOut();
              setLoading(false);
              return;
            }
          }
          // Redirect to change password page
          window.location.href = "/change-password";
          return;
        }
      }

      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("redirect") || "/crm";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ في تسجيل الدخول";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-bg">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size={64} showText label="ClalMobile" subtitle="تسجيل دخول الفريق" />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[#71717a] text-xs font-semibold mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="admin@clalmobile.co.il"
              required
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-[#71717a] text-xs font-semibold mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              dir="ltr"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="text-center text-[#3f3f46] text-[10px] mt-6">
          وكيل رسمي لـ HOT Mobile — لوحة تحكم الفريق
        </p>
      </div>
    </div>
  );
}
