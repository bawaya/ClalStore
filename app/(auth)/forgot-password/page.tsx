"use client";

/**
 * /forgot-password — kicks off the password recovery flow.
 *
 * Applies to admin, CRM, and Sales PWA users — they all authenticate
 * through the same Supabase project, so one reset email handles all three.
 *
 * Flow:
 *   1. User enters their email → submit
 *   2. We call supabase.auth.resetPasswordForEmail with redirectTo=/reset-password
 *   3. Supabase sends the recovery email (or silently does nothing if the
 *      email isn't registered — we never leak that info to the UI)
 *   4. User receives the email, clicks the link → lands on /reset-password
 *      with a recovery session attached to the URL hash
 *
 * Security:
 *   - Response message is the same whether the email exists or not
 *     (timing differences are minimised by the shared signIn codepath)
 *   - Rate limiting is handled by Supabase Auth server-side
 */

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const { requireBrowserSupabase } = await import("@/lib/supabase");
      const supabase = requireBrowserSupabase();

      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://www.clalmobile.com";

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${origin}/reset-password` },
      );

      // Intentionally do NOT surface resetErr to the UI — we don't want
      // to leak whether the email is registered. Supabase's rate limit
      // errors are the only exception worth surfacing (to prevent the
      // user from spamming and getting locked out silently).
      if (resetErr?.message?.toLowerCase().includes("rate")) {
        setError("لقد طلبت إعادة التعيين مؤخراً. انتظر دقيقة وحاول مجدداً.");
        return;
      }

      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ في الاتصال. حاول مرة ثانية.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size={64} showText label="ClalMobile" subtitle="استعادة كلمة المرور" />
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 text-sm text-center">
              <div className="font-bold mb-1">تم الإرسال</div>
              <p className="text-xs text-green-300/90">
                إذا كان البريد مسجلاً في النظام، رح يوصلك رابط إعادة التعيين خلال
                دقائق. تحقق من صندوق الوارد والـ Junk/Spam.
              </p>
            </div>
            <div className="text-center space-y-2">
              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-[#71717a] text-xs hover:text-[#a1a1aa] underline underline-offset-2"
              >
                إرسال لبريد آخر
              </button>
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
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-[#a1a1aa] text-xs text-center mb-2">
              أدخل بريدك الإلكتروني ورح نرسل لك رابط لإعادة تعيين كلمة المرور
            </p>

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
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-[#71717a] text-xs hover:text-[#a1a1aa] underline underline-offset-2"
              >
                العودة لتسجيل الدخول
              </Link>
            </div>
          </form>
        )}

        <p className="text-center text-[#3f3f46] text-[10px] mt-6">
          وكيل رسمي لـ HOT Mobile — لوحة تحكم الفريق
        </p>
      </div>
    </div>
  );
}
