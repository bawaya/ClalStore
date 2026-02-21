// =====================================================
// ClalMobile — Customer Login Page (OTP via WhatsApp)
// Step 1: Enter phone → Step 2: Enter 4-digit OTP
// =====================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";

export default function AuthPage() {
  const scr = useScreen();
  const { t } = useLang();
  const router = useRouter();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ===== Send OTP =====
  const handleSendOtp = async () => {
    setError("");
    const clean = phone.replace(/[-\s]/g, "");
    if (!/^05\d{8}$/.test(clean)) {
      setError(t("auth.invalidPhone"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean, action: "send_otp" }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("otp");
        setCountdown(60);
        setTimeout(() => otpRefs[3]?.current?.focus(), 200);
      } else {
        setError(data.error || t("auth.sendError"));
      }
    } catch {
      setError(t("auth.sendError"));
    } finally {
      setLoading(false);
    }
  };

  // ===== Verify OTP =====
  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 4) {
      setError(t("auth.invalidOtp"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/[-\s]/g, ""), action: "verify_otp", otp: code }),
      });
      const data = await res.json();
      if (data.success) {
        // Store token + customer data in localStorage
        localStorage.setItem("clal_customer_token", data.token);
        localStorage.setItem("clal_customer", JSON.stringify(data.customer));
        // Redirect to account or previous page
        const returnUrl = new URLSearchParams(window.location.search).get("return") || "/store/account";
        router.push(returnUrl);
      } else {
        setError(data.error || t("auth.verifyError"));
      }
    } catch {
      setError(t("auth.verifyError"));
    } finally {
      setLoading(false);
    }
  };

  // ===== OTP Input Handling =====
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Move to previous on input (RTL: right to left entry)
    if (value && index > 0) {
      otpRefs[index - 1]?.current?.focus();
    }

    // Auto-submit when all 4 filled
    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 4) {
      setTimeout(() => handleVerifyOtp(), 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index < 3) {
      otpRefs[index + 1]?.current?.focus();
    }
  };

  // ===== Resend OTP =====
  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp(["", "", "", ""]);
    await handleSendOtp();
  };

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />
      <div
        className="max-w-md mx-auto"
        style={{ padding: scr.mobile ? "40px 20px" : "80px 24px" }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div style={{ fontSize: scr.mobile ? 48 : 56 }} className="mb-3">👤</div>
          <h1 className="font-black mb-1" style={{ fontSize: scr.mobile ? 22 : 28 }}>
            {t("auth.title")}
          </h1>
          <p className="text-muted" style={{ fontSize: scr.mobile ? 12 : 14 }}>
            {step === "phone" ? t("auth.phoneDesc") : t("auth.otpDesc")}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-xl text-center font-bold mb-4"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              padding: "10px 16px",
              fontSize: scr.mobile ? 12 : 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Step 1: Phone */}
        {step === "phone" && (
          <div className="space-y-4">
            <div>
              <label className="block text-muted font-bold mb-1.5" style={{ fontSize: scr.mobile ? 12 : 13 }}>
                {t("auth.phoneLabel")}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05X-XXXXXXX"
                dir="ltr"
                className="w-full bg-surface-card border border-surface-border rounded-xl text-white text-center outline-none focus:border-[#c41040] transition-colors"
                style={{
                  padding: scr.mobile ? "14px 16px" : "16px 20px",
                  fontSize: scr.mobile ? 18 : 22,
                  letterSpacing: 2,
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full rounded-xl font-extrabold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background: "#c41040",
                border: "none",
                color: "#fff",
                padding: scr.mobile ? "14px 0" : "16px 0",
                fontSize: scr.mobile ? 14 : 16,
              }}
            >
              {loading ? t("auth.sending") : t("auth.sendOtp")}
            </button>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <div className="space-y-4">
            {/* Phone display */}
            <div className="text-center mb-2">
              <span className="text-muted" style={{ fontSize: scr.mobile ? 11 : 13 }}>
                {t("auth.sentTo")}{" "}
              </span>
              <span className="font-bold text-brand" dir="ltr">{phone}</span>
              <button
                onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); setError(""); }}
                className="text-brand underline bg-transparent border-0 cursor-pointer mr-2"
                style={{ fontSize: scr.mobile ? 11 : 12 }}
              >
                {t("auth.changePhone")}
              </button>
            </div>

            {/* OTP Inputs (RTL: 4 boxes right to left) */}
            <div className="flex justify-center gap-3" dir="ltr">
              {[3, 2, 1, 0].map((i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i]}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="bg-surface-card border-2 border-surface-border rounded-xl text-white text-center outline-none focus:border-[#c41040] transition-colors font-black"
                  style={{
                    width: scr.mobile ? 56 : 64,
                    height: scr.mobile ? 56 : 64,
                    fontSize: scr.mobile ? 24 : 28,
                  }}
                />
              ))}
            </div>

            {/* Verify button */}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.some((d) => d === "")}
              className="w-full rounded-xl font-extrabold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background: "#c41040",
                border: "none",
                color: "#fff",
                padding: scr.mobile ? "14px 0" : "16px 0",
                fontSize: scr.mobile ? 14 : 16,
              }}
            >
              {loading ? t("auth.verifying") : t("auth.verify")}
            </button>

            {/* Resend */}
            <div className="text-center">
              {countdown > 0 ? (
                <span className="text-muted" style={{ fontSize: scr.mobile ? 11 : 13 }}>
                  {t("auth.resendIn")} {countdown} {t("auth.seconds")}
                </span>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-brand underline bg-transparent border-0 cursor-pointer font-bold"
                  style={{ fontSize: scr.mobile ? 12 : 13 }}
                >
                  {t("auth.resend")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-dim mt-8" style={{ fontSize: scr.mobile ? 10 : 11, lineHeight: 1.6 }}>
          {t("auth.footerNote")}
        </p>
      </div>
    </div>
  );
}
