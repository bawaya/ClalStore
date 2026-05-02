"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/website/sections";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { csrfHeaders } from "@/lib/csrf-client";

type Step = "phone" | "channel" | "otp";
type Channel = "sms" | "whatsapp";

export default function AuthPage() {
  const scr = useScreen();
  const { t, lang } = useLang();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sentChannel, setSentChannel] = useState<Channel>("sms");

  const otpRef0 = useRef<HTMLInputElement>(null);
  const otpRef1 = useRef<HTMLInputElement>(null);
  const otpRef2 = useRef<HTMLInputElement>(null);
  const otpRef3 = useRef<HTMLInputElement>(null);
  const otpRefs = useMemo(() => [otpRef0, otpRef1, otpRef2, otpRef3], []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handlePhoneSubmit = () => {
    setError("");
    const clean = phone.replace(/[-\s]/g, "");
    if (!/^05\d{8}$/.test(clean)) {
      setError(t("auth.invalidPhone"));
      return;
    }
    setStep("channel");
  };

  const handleSendOtp = useCallback(
    async (selectedChannel?: Channel) => {
      const activeChannel = selectedChannel || channel;
      setError("");
      setLoading(true);
      try {
        const response = await fetch("/api/auth/customer", {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            phone: phone.replace(/[-\s]/g, ""),
            action: "send_otp",
            channel: activeChannel,
          }),
        });
        const json = await response.json();
        const data = json.data ?? json;
        if (json.success) {
          setSentChannel(data.channel || activeChannel);
          setStep("otp");
          setCountdown(60);
          setTimeout(() => otpRefs[0]?.current?.focus(), 200);
        } else {
          setError(json.error || data.error || t("auth.sendError"));
        }
      } catch {
        setError(t("auth.sendError"));
      } finally {
        setLoading(false);
      }
    },
    [channel, otpRefs, phone, t]
  );

  const handleVerifyOtp = useCallback(
    async (codeOverride?: string) => {
      const code = codeOverride || otp.join("");
      if (code.length !== 4) {
        setError(t("auth.invalidOtp"));
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/auth/customer", {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            phone: phone.replace(/[-\s]/g, ""),
            action: "verify_otp",
            otp: code,
          }),
        });
        const json = await response.json();
        const data = json.data ?? json;
        if (json.success) {
          localStorage.setItem("clal_customer_token", data.token);
          localStorage.setItem("clal_customer", JSON.stringify(data.customer));
          const returnUrl =
            new URLSearchParams(window.location.search).get("return") ||
            "/store/account";
          router.push(returnUrl);
        } else {
          setError(json.error || data.error || t("auth.verifyError"));
        }
      } catch {
        setError(t("auth.verifyError"));
      } finally {
        setLoading(false);
      }
    },
    [otp, phone, router, t]
  );

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const nextOtp = [...otp];
    nextOtp[index] = value.slice(-1);
    setOtp(nextOtp);
    if (value && index < 3) otpRefs[index + 1]?.current?.focus();
    if (nextOtp.every((digit) => digit !== "") && nextOtp.join("").length === 4) {
      const code = nextOtp.join("");
      setTimeout(() => handleVerifyOtp(code), 150);
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1]?.current?.focus();
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (pasted.length === 4) {
      setOtp(pasted.split("") as [string, string, string, string]);
      otpRefs[3]?.current?.focus();
      setTimeout(() => handleVerifyOtp(pasted), 200);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp(["", "", "", ""]);
    setError("");
    await handleSendOtp(sentChannel);
  };

  const goBack = () => {
    setError("");
    if (step === "otp") {
      setStep("channel");
      setOtp(["", "", "", ""]);
    } else if (step === "channel") {
      setStep("phone");
    }
  };

  const stepIndex = step === "phone" ? 0 : step === "channel" ? 1 : 2;
  const progress = [
    {
      title: lang === "he" ? "טלפון" : "الهاتف",
      caption: lang === "he" ? "אימות מספר" : "التحقق من الرقم",
    },
    {
      title: lang === "he" ? "ערוץ" : "القناة",
      caption: lang === "he" ? "בחירת משלוח" : "اختيار الإرسال",
    },
    {
      title: lang === "he" ? "קוד" : "الرمز",
      caption: lang === "he" ? "כניסה לחשבון" : "الدخول للحساب",
    },
  ];

  const copy =
    lang === "he"
      ? {
          badge: "כניסת לקוח",
          title: "אימות מהיר לחשבון החנות",
          subtitle:
            "כניסה מאובטחת בשלושה שלבים ברורים: מספר טלפון, ערוץ שליחה, ואז קוד חד-פעמי.",
          helper:
            "האימות נועד להחזיר את פרטי הלקוח, ההזמנות, והמועדפים בלי צורך בסיסמה.",
          continue: "המשך",
          chooseSms: "SMS",
          chooseWhatsapp: "WhatsApp",
          resendIn: `${t("auth.resendIn")} ${countdown} ${t("auth.seconds")}`,
        }
      : {
          badge: "دخول العميل",
          title: "تحقق سريع وآمن لحساب المتجر",
          subtitle:
            "الدخول هنا يتم عبر ثلاث خطوات واضحة: رقم الهاتف، قناة الإرسال، ثم رمز تحقق لمرة واحدة.",
          helper:
            "هذا المسار يعيد لك بياناتك وطلباتك ومفضلتك من دون الحاجة إلى كلمة مرور تقليدية.",
          continue: "متابعة",
          chooseSms: "SMS",
          chooseWhatsapp: "WhatsApp",
          resendIn: `${t("auth.resendIn")} ${countdown} ${t("auth.seconds")}`,
        };

  return (
    <div
      dir="rtl"
      className="font-arabic min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 26%)",
      }}
    >
      <StoreHeader showBack />

      <div
        className="mx-auto max-w-5xl"
        style={{ padding: scr.mobile ? "16px 14px 80px" : "24px 24px 110px" }}
      >
        <section className="mb-5 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                {copy.badge}
              </span>
              <h1 className="mt-3 text-2xl font-black leading-tight md:text-[2.4rem]">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-[#b8b8c2] md:text-base">
                {copy.subtitle}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-[#8f8f99]">
                {copy.helper}
              </p>
            </div>

            <div className="grid gap-3">
              {progress.map((item, index) => (
                <div
                  key={item.title}
                  className={`rounded-[22px] border px-4 py-4 text-right ${
                    index === stepIndex
                      ? "border-[#ff3351]/45 bg-[#ff3351]/10"
                      : index < stepIndex
                        ? "border-[#1f6d47] bg-[#0d2419]"
                        : "border-[#2f2f38] bg-white/[0.02]"
                  }`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      index === stepIndex
                        ? "text-[#ff8da0]"
                        : index < stepIndex
                          ? "text-[#8ce2ae]"
                          : "text-[#8f8f99]"
                    }`}
                  >
                    {`0${index + 1}`.slice(-2)}
                  </div>
                  <div className="mt-2 text-sm font-black text-white">{item.title}</div>
                  <div className="mt-1 text-xs leading-6 text-[#b8b8c2]">
                    {item.caption}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-xl rounded-[30px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-6 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6">
          <div className="mb-6 text-center">
            <div className="text-5xl">
              {step === "phone" ? "📱" : step === "channel" ? "💬" : "🔐"}
            </div>
            <h2 className="mt-3 text-xl font-black text-white md:text-2xl">
              {step === "phone"
                ? t("auth.title")
                : step === "channel"
                  ? t("auth.chooseChannel")
                  : t("auth.enterCode")}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[#b8b8c2]">
              {step === "phone"
                ? t("auth.phoneDesc")
                : step === "channel"
                  ? t("auth.channelDesc")
                  : sentChannel === "sms"
                    ? t("auth.otpDescSms")
                    : t("auth.otpDescWa")}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-[22px] border border-[#6a2232] bg-[#2a1016] px-4 py-3 text-center text-sm font-semibold text-[#ff8297]">
              {error}
            </div>
          )}

          {step === "phone" && (
            <div className="space-y-4">
              <label className="block text-right">
                <span className="mb-1.5 block text-[11px] font-semibold text-[#9d9daa] desktop:text-xs">
                  {lang === "he" ? "מספר טלפון" : "رقم الهاتف"}
                </span>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-sm font-bold text-[#9d9daa]">
                    <span>🇮🇱</span>
                    <span>+972</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value.replace(/[^\d-\s]/g, ""))
                    }
                    placeholder="05X-XXXXXXX"
                    dir="ltr"
                    className="w-full rounded-2xl border border-[#4a4a54] bg-white/[0.03] px-4 py-4 pl-[110px] text-center text-xl text-white outline-none placeholder:text-[#8f8f99] focus:border-[#ff3351] md:text-2xl"
                    onKeyDown={(event) => event.key === "Enter" && handlePhoneSubmit()}
                    autoFocus
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={handlePhoneSubmit}
                className="inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f]"
              >
                {copy.continue}
              </button>
            </div>
          )}

          {step === "channel" && (
            <div className="space-y-4">
              <div className="text-center text-sm text-[#b8b8c2]">
                {t("auth.sendingTo")}{" "}
                <span className="font-black text-white" dir="ltr">
                  {phone}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setChannel("sms");
                    void handleSendOtp("sms");
                  }}
                  disabled={loading}
                  className={`rounded-[24px] border px-5 py-6 text-center transition-transform hover:scale-[1.01] disabled:opacity-60 ${
                    channel === "sms"
                      ? "border-[#ff3351]/45 bg-[#ff3351]/10"
                      : "border-[#30303a] bg-white/[0.03]"
                  }`}
                >
                  <div className="text-4xl">📱</div>
                  <div className="mt-3 text-lg font-black text-white">
                    {copy.chooseSms}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[#b8b8c2]">
                    {t("auth.smsDesc")}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setChannel("whatsapp");
                    void handleSendOtp("whatsapp");
                  }}
                  disabled={loading}
                  className={`rounded-[24px] border px-5 py-6 text-center transition-transform hover:scale-[1.01] disabled:opacity-60 ${
                    channel === "whatsapp"
                      ? "border-[#1f6d47] bg-[#0d2419]"
                      : "border-[#30303a] bg-white/[0.03]"
                  }`}
                >
                  <div className="text-4xl">💬</div>
                  <div className="mt-3 text-lg font-black text-[#8ce2ae]">
                    {copy.chooseWhatsapp}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[#b8b8c2]">
                    {t("auth.waDesc")}
                  </div>
                </button>
              </div>

              {loading && (
                <div className="text-center text-sm text-[#b8b8c2]">{t("auth.sending")}</div>
              )}

              <button
                type="button"
                onClick={goBack}
                className="w-full text-center text-sm font-bold text-[#9d9daa] transition-colors hover:text-white"
              >
                ← {t("auth.changePhone")}
              </button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div className="text-center">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${
                    sentChannel === "sms"
                      ? "border border-[#ff3351]/20 bg-[#ff3351]/10 text-[#ff8da0]"
                      : "border border-[#1f6d47] bg-[#0d2419] text-[#8ce2ae]"
                  }`}
                >
                  <span>{sentChannel === "sms" ? "📱" : "💬"}</span>
                  <span>{sentChannel === "sms" ? "SMS" : "WhatsApp"}</span>
                </span>
                <div className="mt-3 text-sm text-[#b8b8c2]">
                  {t("auth.sentTo")}{" "}
                  <span className="font-black text-white" dir="ltr">
                    {phone}
                  </span>
                </div>
              </div>

              <div className="flex justify-center gap-3" dir="ltr" onPaste={handleOtpPaste}>
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={otp[index]}
                    onChange={(event) => handleOtpChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    className="h-16 w-16 rounded-[22px] border-2 border-[#3a3a44] bg-white/[0.03] text-center text-2xl font-black text-white outline-none transition-colors focus:border-[#ff3351] md:h-[72px] md:w-[72px] md:text-3xl"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleVerifyOtp()}
                disabled={loading || otp.some((digit) => digit === "")}
                className="inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f] disabled:opacity-60"
              >
                {loading ? t("auth.verifying") : t("auth.verify")}
              </button>

              <div className="flex flex-col items-center gap-2">
                {countdown > 0 ? (
                  <span className="text-sm text-[#b8b8c2]">{copy.resendIn}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    className="text-sm font-bold text-[#ff6b82] hover:underline"
                  >
                    {t("auth.resend")}
                  </button>
                )}

                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-[#9d9daa] transition-colors hover:text-white"
                >
                  {t("auth.tryOtherChannel")}
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs leading-7 text-[#8f8f99]">
            {t("auth.footerNote")}
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
}
