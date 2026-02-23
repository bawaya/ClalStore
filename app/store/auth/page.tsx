// =====================================================
// ClalMobile — Customer Login (3-Step: Phone → Channel → OTP)
// Modern design with SMS / WhatsApp channel selection
// =====================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";

type Step = "phone" | "channel" | "otp";
type Channel = "sms" | "whatsapp";

export default function AuthPage() {
  const scr = useScreen();
  const { t } = useLang();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sentChannel, setSentChannel] = useState<Channel>("sms");

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ===== Step 1 → Step 2: Validate phone =====
  const handlePhoneSubmit = () => {
    setError("");
    const clean = phone.replace(/[-\s]/g, "");
    if (!/^05\d{8}$/.test(clean)) {
      setError(t("auth.invalidPhone"));
      return;
    }
    setStep("channel");
  };

  // ===== Step 2 → Step 3: Send OTP via chosen channel =====
  const handleSendOtp = useCallback(async (selectedChannel?: Channel) => {
    const ch = selectedChannel || channel;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/[-\s]/g, ""),
          action: "send_otp",
          channel: ch,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSentChannel(data.channel || ch);
        setStep("otp");
        setCountdown(60);
        setTimeout(() => otpRefs[0]?.current?.focus(), 200);
      } else {
        setError(data.error || t("auth.sendError"));
      }
    } catch {
      setError(t("auth.sendError"));
    } finally {
      setLoading(false);
    }
  }, [channel, phone, t]);

  // ===== Verify OTP =====
  const handleVerifyOtp = useCallback(async () => {
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
        body: JSON.stringify({
          phone: phone.replace(/[-\s]/g, ""),
          action: "verify_otp",
          otp: code,
        }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("clal_customer_token", data.token);
        localStorage.setItem("clal_customer", JSON.stringify(data.customer));
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
  }, [otp, phone, router, t]);

  // ===== OTP Input =====
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 3) otpRefs[index + 1]?.current?.focus();
    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 4) {
      setTimeout(() => handleVerifyOtp(), 150);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1]?.current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setOtp(pasted.split("") as [string, string, string, string]);
      otpRefs[3]?.current?.focus();
      setTimeout(() => handleVerifyOtp(), 200);
    }
  };

  // ===== Resend =====
  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp(["", "", "", ""]);
    setError("");
    await handleSendOtp(sentChannel);
  };

  // ===== Go back =====
  const goBack = () => {
    setError("");
    if (step === "otp") { setStep("channel"); setOtp(["", "", "", ""]); }
    else if (step === "channel") setStep("phone");
  };

  const isMobile = scr.mobile;
  const stepIndex = step === "phone" ? 0 : step === "channel" ? 1 : 2;

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />

      <div className="max-w-md mx-auto" style={{ padding: isMobile ? "32px 20px" : "60px 24px" }}>

        {/* ===== Progress Indicator ===== */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {([0, 1, 2]).map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="rounded-full flex items-center justify-center font-black transition-all"
                style={{
                  width: 32, height: 32,
                  fontSize: 13,
                  background: stepIndex === i ? "#c41040" : (stepIndex > i ? "rgba(196,16,64,0.3)" : "rgba(255,255,255,0.08)"),
                  color: stepIndex === i ? "#fff" : (stepIndex > i ? "#c41040" : "#555"),
                  border: stepIndex === i ? "2px solid #c41040" : "2px solid transparent",
                }}
              >
                {stepIndex > i ? "✓" : i + 1}
              </div>
              {i < 2 && (
                <div style={{
                  width: isMobile ? 40 : 60, height: 2,
                  background: stepIndex > i ? "#c41040" : "rgba(255,255,255,0.1)",
                  borderRadius: 1,
                }} />
              )}
            </div>
          ))}
        </div>

        {/* ===== Header ===== */}
        <div className="text-center mb-6">
          <div style={{ fontSize: isMobile ? 44 : 52 }} className="mb-2">
            {step === "phone" ? "📱" : step === "channel" ? "💬" : "🔐"}
          </div>
          <h1 className="font-black mb-1" style={{ fontSize: isMobile ? 22 : 28 }}>
            {step === "phone" ? t("auth.title") : step === "channel" ? t("auth.chooseChannel") : t("auth.enterCode")}
          </h1>
          <p className="text-muted" style={{ fontSize: isMobile ? 12 : 14 }}>
            {step === "phone"
              ? t("auth.phoneDesc")
              : step === "channel"
                ? t("auth.channelDesc")
                : sentChannel === "sms" ? t("auth.otpDescSms") : t("auth.otpDescWa")}
          </p>
        </div>

        {/* ===== Error ===== */}
        {error && (
          <div
            className="rounded-xl text-center font-bold mb-4"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              padding: "10px 16px",
              fontSize: isMobile ? 12 : 13,
            }}
          >
            {error}
          </div>
        )}

        {/* =============== STEP 1: PHONE =============== */}
        {step === "phone" && (
          <div className="space-y-4">
            <div className="relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none"
                style={{ left: 16, fontSize: isMobile ? 14 : 16 }}
              >
                <span>🇮🇱</span>
                <span className="text-muted font-bold" style={{ fontSize: isMobile ? 14 : 16 }}>+972</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d-\s]/g, ""))}
                placeholder="05X-XXXXXXX"
                dir="ltr"
                className="w-full bg-surface-card border border-surface-border rounded-2xl text-white outline-none focus:border-[#c41040] transition-all"
                style={{
                  padding: isMobile ? "16px 16px 16px 100px" : "18px 20px 18px 110px",
                  fontSize: isMobile ? 20 : 24,
                  letterSpacing: 2,
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                autoFocus
              />
            </div>

            <button
              onClick={handlePhoneSubmit}
              className="w-full rounded-2xl font-extrabold cursor-pointer transition-all active:scale-[0.98] hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #c41040, #e51050)",
                border: "none",
                color: "#fff",
                padding: isMobile ? "15px 0" : "17px 0",
                fontSize: isMobile ? 15 : 17,
                boxShadow: "0 4px 20px rgba(196,16,64,0.3)",
              }}
            >
              {t("auth.continue")}
            </button>
          </div>
        )}

        {/* =============== STEP 2: CHANNEL CHOICE =============== */}
        {step === "channel" && (
          <div className="space-y-4">
            {/* Phone display */}
            <div className="text-center mb-2">
              <span className="text-muted" style={{ fontSize: isMobile ? 12 : 13 }}>
                {t("auth.sendingTo")}
              </span>
              <span className="font-black text-white mr-2" dir="ltr" style={{ fontSize: isMobile ? 16 : 18 }}>
                {phone}
              </span>
            </div>

            {/* Channel cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* SMS Card */}
              <button
                onClick={() => { setChannel("sms"); handleSendOtp("sms"); }}
                disabled={loading}
                className="rounded-2xl text-center cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: channel === "sms" ? "rgba(196,16,64,0.15)" : "rgba(255,255,255,0.04)",
                  border: channel === "sms" ? "2px solid #c41040" : "2px solid rgba(255,255,255,0.08)",
                  padding: isMobile ? "24px 12px" : "28px 16px",
                }}
              >
                <div style={{ fontSize: isMobile ? 36 : 44 }} className="mb-2">📱</div>
                <div className="font-black text-white" style={{ fontSize: isMobile ? 15 : 17 }}>SMS</div>
                <div className="text-muted mt-1" style={{ fontSize: isMobile ? 10 : 11 }}>
                  {t("auth.smsDesc")}
                </div>
              </button>

              {/* WhatsApp Card */}
              <button
                onClick={() => { setChannel("whatsapp"); handleSendOtp("whatsapp"); }}
                disabled={loading}
                className="rounded-2xl text-center cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: channel === "whatsapp" ? "rgba(37,211,102,0.12)" : "rgba(255,255,255,0.04)",
                  border: channel === "whatsapp" ? "2px solid #25d366" : "2px solid rgba(255,255,255,0.08)",
                  padding: isMobile ? "24px 12px" : "28px 16px",
                }}
              >
                <div style={{ fontSize: isMobile ? 36 : 44 }} className="mb-2">💬</div>
                <div className="font-black" style={{ fontSize: isMobile ? 15 : 17, color: "#25d366" }}>WhatsApp</div>
                <div className="text-muted mt-1" style={{ fontSize: isMobile ? 10 : 11 }}>
                  {t("auth.waDesc")}
                </div>
              </button>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="text-center py-3">
                <div className="inline-block animate-spin rounded-full border-2 border-white border-t-transparent" style={{ width: 24, height: 24 }} />
                <p className="text-muted mt-2" style={{ fontSize: isMobile ? 12 : 13 }}>{t("auth.sending")}</p>
              </div>
            )}

            {/* Back */}
            <button
              onClick={goBack}
              className="w-full text-center text-muted bg-transparent border-0 cursor-pointer font-bold hover:text-white transition-colors"
              style={{ fontSize: isMobile ? 12 : 13, padding: "8px 0" }}
            >
              ← {t("auth.changePhone")}
            </button>
          </div>
        )}

        {/* =============== STEP 3: OTP =============== */}
        {step === "otp" && (
          <div className="space-y-4">
            {/* Channel badge + phone */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full font-bold"
                style={{
                  background: sentChannel === "sms" ? "rgba(196,16,64,0.12)" : "rgba(37,211,102,0.12)",
                  color: sentChannel === "sms" ? "#c41040" : "#25d366",
                  padding: "5px 16px",
                  fontSize: isMobile ? 12 : 13,
                }}
              >
                {sentChannel === "sms" ? "📱 SMS" : "💬 WhatsApp"}
              </span>
              <div>
                <span className="text-muted" style={{ fontSize: isMobile ? 11 : 13 }}>
                  {t("auth.sentTo")}{" "}
                </span>
                <span className="font-black text-white" dir="ltr">{phone}</span>
              </div>
            </div>

            {/* OTP Inputs */}
            <div className="flex justify-center gap-3" dir="ltr" onPaste={handleOtpPaste}>
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={otp[i]}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="bg-surface-card border-2 border-surface-border rounded-2xl text-white text-center outline-none focus:border-[#c41040] transition-all font-black"
                  style={{
                    width: isMobile ? 58 : 68,
                    height: isMobile ? 58 : 68,
                    fontSize: isMobile ? 26 : 30,
                    boxShadow: otp[i] ? "0 0 12px rgba(196,16,64,0.2)" : "none",
                  }}
                />
              ))}
            </div>

            {/* Verify button */}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.some((d) => d === "")}
              className="w-full rounded-2xl font-extrabold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #c41040, #e51050)",
                border: "none",
                color: "#fff",
                padding: isMobile ? "15px 0" : "17px 0",
                fontSize: isMobile ? 15 : 17,
                boxShadow: "0 4px 20px rgba(196,16,64,0.3)",
              }}
            >
              {loading ? t("auth.verifying") : t("auth.verify")}
            </button>

            {/* Resend + Change channel */}
            <div className="flex flex-col items-center gap-2">
              {countdown > 0 ? (
                <span className="text-muted" style={{ fontSize: isMobile ? 11 : 13 }}>
                  {t("auth.resendIn")} {countdown} {t("auth.seconds")}
                </span>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-brand bg-transparent border-0 cursor-pointer font-bold hover:underline"
                  style={{ fontSize: isMobile ? 12 : 13 }}
                >
                  {t("auth.resend")}
                </button>
              )}

              <button
                onClick={goBack}
                className="text-muted bg-transparent border-0 cursor-pointer hover:text-white transition-colors"
                style={{ fontSize: isMobile ? 11 : 12 }}
              >
                {t("auth.tryOtherChannel")}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-dim mt-8" style={{ fontSize: isMobile ? 10 : 11, lineHeight: 1.6 }}>
          {t("auth.footerNote")}
        </p>
      </div>
    </div>
  );
}
