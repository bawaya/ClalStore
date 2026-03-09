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
      await signIn(email, password);
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("redirect") || "/crm";
    } catch (err: any) {
      setError(err.message || "خطأ في تسجيل الدخول");
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
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "جاري الدخول..." : "🔐 تسجيل الدخول"}
          </button>
        </form>

        <p className="text-center text-[#3f3f46] text-[10px] mt-6">
          وكيل رسمي لـ HOT Mobile — لوحة تحكم الفريق
        </p>
      </div>
    </div>
  );
}
