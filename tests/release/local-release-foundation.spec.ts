import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  appendManifestArtifact,
  attachPageGuards,
  findInputByLabel,
} from "./helpers/protocol";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";
const runId = process.env.TEST_RUN_ID || "release_local";
const allowLogoUpload = process.env.E2E_ALLOW_LOGO_UPLOAD === "1";

async function loginToAdminSettings(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/login?redirect=%2Fadmin%2Fsettings");
  const emailInput = await findInputByLabel(page, "البريد الإلكتروني");
  const passwordInput = await findInputByLabel(page, "كلمة المرور");
  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(/\/admin\/settings/, { timeout: 30_000 });
}

async function acceptCookiesIfPresent(page: Parameters<typeof test>[0]["page"]) {
  const acceptButton = page.getByRole("button", { name: /قبول الكل/ }).first();
  if (await acceptButton.isVisible().catch(() => false)) {
    await acceptButton.click();
    await expect(acceptButton).toHaveCount(0);
  }
}

test.describe.configure({ mode: "serial" });

test("نسيان كلمة المرور يعرض رسالة عامة من دون تسريب", async ({ page }) => {
  const guards = attachPageGuards(page);

  await page.route(/\/auth\/v1\/recover/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto("/forgot-password");
  const emailInput = await findInputByLabel(page, "البريد الإلكتروني");
  await emailInput.fill(`test_${runId}@clalmobile.test`);
  await page.getByRole("button", { name: "إرسال رابط إعادة التعيين" }).click();

  await expect(page.getByText("تم الإرسال")).toBeVisible();
  await appendManifestArtifact({
    kind: "note",
    title: "forgot-password-ui",
    status: "verified_local_browser",
    message: "تمت مراجعة تدفق نسيان كلمة المرور بواجهة المتصفح مع اعتراض recover محليًا.",
  });
  await guards.assertClean();
});

test("إعادة التعيين بلا جلسة استعادة تعرض شاشة الرابط غير الصالح", async ({ page }) => {
  const guards = attachPageGuards(page);

  await page.goto("/reset-password");
  await expect(page.getByText("الرابط غير صالح أو انتهت صلاحيته")).toBeVisible();
  await expect(page.getByRole("link", { name: "طلب رابط جديد" })).toBeVisible();
  await appendManifestArtifact({
    kind: "note",
    title: "reset-password-invalid-session",
    status: "verified_local_browser",
    message: "تم التحقق محليًا من شاشة الرابط غير الصالح عند غياب جلسة الاستعادة.",
  });
  await guards.assertClean();
});

test("إعدادات المتجر تسمح بحفظ وصف عربي مع تمهيد واضح لرفع الشعار", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "بيانات دخول الإدارة غير متوفرة لهذه الحزمة.");

  const guards = attachPageGuards(page);
  await loginToAdminSettings(page);
  await acceptCookiesIfPresent(page);

  const adminCrashHeading = page.getByRole("heading", { name: "حدث خطأ في لوحة التحكم" });
  if (await adminCrashHeading.isVisible().catch(() => false)) {
    throw new Error(
      `admin-settings-error-boundary ${JSON.stringify(guards.snapshot(), null, 2)}`,
    );
  }

  await expect(page.getByRole("button", { name: "المتجر" })).toBeVisible();
  await expect(page.getByText("جارٍ تحميل الإعدادات...")).toHaveCount(0);

  await page.getByRole("button", { name: "المتجر" }).click();
  const taglineInput = await findInputByLabel(page, "الوصف العربي");
  const nextValue = `اختبار آلي ${runId}`;
  const saveResponse = page.waitForResponse((response) => {
    return (
      response.url().includes("/api/admin/settings") &&
      response.request().method() === "PUT" &&
      response.status() === 200
    );
  });

  await taglineInput.fill(nextValue);
  await taglineInput.blur();
  await saveResponse;
  await page.reload();
  await acceptCookiesIfPresent(page);

  const refreshedInput = await findInputByLabel(page, "الوصف العربي");
  await expect(refreshedInput).toHaveValue(nextValue);

  const logoButton = page.getByRole("button", { name: "رفع شعار" });
  await expect(logoButton).toBeVisible();

  if (allowLogoUpload) {
    const filePath = path.join(process.cwd(), "tests", "release", "fixtures", "test-logo.svg");
    const uploadResponse = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/admin/upload-logo") &&
        response.request().method() === "POST"
      );
    });
    const logoSettingSaveResponse = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/admin/settings") &&
        response.request().method() === "PUT" &&
        response.status() === 200
      );
    });

    await page.setInputFiles('input[type="file"]', filePath);
    const response = await uploadResponse;
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.url).toBeTruthy();
    await logoSettingSaveResponse;
    await expect(page.getByText("تم رفع الشعار بنجاح")).toBeVisible();

    await appendManifestArtifact({
      kind: "storage_remove_public_url",
      url: payload.url,
    });
    await appendManifestArtifact({
      kind: "note",
      title: "logo-upload-local",
      status: "verified_local_browser",
      message: "تم تنفيذ رفع شعار محليًا ضمن الحزمة التفاعلية.",
    });
  } else {
    await appendManifestArtifact({
      kind: "note",
      title: "logo-upload-constrained",
      status: "constrained",
      message:
        "تم الاكتفاء بتمهيد رفع الشعار والتحقق من الواجهة، ولم يُنفذ الرفع لأن هناك شعارًا قائمًا يحتاج استرجاع ملفه نفسه.",
    });
  }

  await appendManifestArtifact({
    kind: "note",
    title: "store-settings-save",
    status: "verified_local_browser",
    message: "تم تسجيل الدخول إداريًا وحفظ الوصف العربي وإعادة تحميل الصفحة للتحقق من بقاء القيمة.",
  });

  await page.route("**/api/admin/integrations/test", async (route) => {
    const body = route.request().postDataJSON?.() || {};
    const provider = typeof body.provider === "string" && body.provider.trim() ? body.provider : "integration";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: `اختبار واجهة آمن ناجح: ${provider}`,
      }),
    });
  });

  await page.getByRole("button", { name: "التكاملات" }).click();

  const aiSettingsTitle = page.getByText(/إعدادات (Google Gemini|Anthropic Claude)/).first();
  const aiSettingsPanel = aiSettingsTitle.locator(
    "xpath=ancestor::div[count(.//input) >= 2 and .//button[normalize-space()='اختبار'] and .//button[normalize-space()='حفظ الإعدادات']][1]",
  );
  await expect(aiSettingsPanel).toBeVisible();
  await aiSettingsPanel.scrollIntoViewIfNeeded();
  await expect(aiSettingsTitle).toBeVisible();

  const apiKeyInput = aiSettingsPanel.locator("input:visible").first();
  const modelInput = aiSettingsPanel.locator("input:visible").nth(1);
  await expect(apiKeyInput).toBeVisible();
  await expect(modelInput).toBeVisible();
  const currentModel = await modelInput.inputValue();
  const apiKeyMaskedValue = await apiKeyInput.inputValue();

  expect(currentModel.trim().length).toBeGreaterThan(0);
  expect(apiKeyMaskedValue.trim().length).toBeGreaterThan(0);

  await aiSettingsPanel.getByRole("button", { name: "اختبار" }).click();
  await expect(aiSettingsPanel.getByText(/اختبار واجهة آمن ناجح:/)).toBeVisible();

  const integrationSaveResponse = page.waitForResponse((response) => {
    return (
      response.url().includes("/api/admin/settings") &&
      response.request().method() === "PUT" &&
      response.status() === 200
    );
  });

  await aiSettingsPanel.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await integrationSaveResponse;

  await page.reload();
  await acceptCookiesIfPresent(page);
  await page.getByRole("button", { name: "التكاملات" }).click();

  const refreshedAiSettingsTitle = page.getByText(/إعدادات (Google Gemini|Anthropic Claude)/).first();
  const refreshedAiSettingsPanel = refreshedAiSettingsTitle.locator(
    "xpath=ancestor::div[count(.//input) >= 2 and .//button[normalize-space()='اختبار'] and .//button[normalize-space()='حفظ الإعدادات']][1]",
  );
  await expect(refreshedAiSettingsPanel).toBeVisible();
  await refreshedAiSettingsPanel.scrollIntoViewIfNeeded();
  await expect(refreshedAiSettingsTitle).toBeVisible();
  const refreshedApiKeyInput = refreshedAiSettingsPanel.locator("input:visible").first();
  const refreshedModelInput = refreshedAiSettingsPanel.locator("input:visible").nth(1);
  await expect(refreshedApiKeyInput).toBeVisible();
  await expect(refreshedModelInput).toBeVisible();

  await expect(refreshedModelInput).toHaveValue(currentModel);
  expect((await refreshedApiKeyInput.inputValue()).trim().length).toBeGreaterThan(0);

  await appendManifestArtifact({
    kind: "note",
    title: "ai-integration-ui-save-safe",
    status: "verified_local_browser",
    message:
      "تم فحص بطاقة ذكاء التكاملات محليًا: حفظ القيم الحالية مع بقاء المفاتيح الحساسة مقنّعة، واختبار زر التحقق عبر mock آمن دون أي اتصال خارجي حقيقي أو إرسال رسائل.",
  });

  const emailSettingsTitle = page.getByText(/إعدادات (Resend|SendGrid)/).first();
  const emailSettingsPanel = emailSettingsTitle.locator(
    "xpath=ancestor::div[count(.//input) >= 2 and .//button[normalize-space()='اختبار'] and .//button[normalize-space()='حفظ الإعدادات']][1]",
  );
  await expect(emailSettingsPanel).toBeVisible();
  await emailSettingsPanel.scrollIntoViewIfNeeded();
  await expect(emailSettingsTitle).toBeVisible();

  const emailApiKeyInput = emailSettingsPanel.locator("input:visible").first();
  const fromEmailInput = emailSettingsPanel.locator("input:visible").nth(1);
  await expect(emailApiKeyInput).toBeVisible();
  await expect(fromEmailInput).toBeVisible();
  expect((await emailApiKeyInput.inputValue()).trim().length).toBeGreaterThan(0);
  expect((await fromEmailInput.inputValue()).trim().length).toBeGreaterThan(0);

  await emailSettingsPanel.getByRole("button", { name: "اختبار" }).click();
  await expect(emailSettingsPanel.getByText(/اختبار واجهة آمن ناجح:/)).toBeVisible();

  const emailSaveResponse = page.waitForResponse((response) => {
    return (
      response.url().includes("/api/admin/settings") &&
      response.request().method() === "PUT" &&
      response.status() === 200
    );
  });

  await emailSettingsPanel.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await emailSaveResponse;

  await appendManifestArtifact({
    kind: "note",
    title: "email-integration-ui-save-safe",
    status: "verified_local_browser",
    message:
      "تم فحص بطاقة البريد محليًا مع mock لزر الاختبار، وتأكدنا من الحفظ من دون إطلاق أي رسائل حقيقية أو اتصال خارجي مرسل.",
  });

  const guardSnapshot = guards.snapshot();
  const logoAssetRequestIssues = guardSnapshot.failedRequests.filter((entry) => {
    return /supabase\.co\/storage\/v1\/object\/public\/brand\/logo\//.test(entry)
      && /net::ERR_(BLOCKED_BY_ORB|ABORTED)/i.test(entry);
  });

  if (logoAssetRequestIssues.length > 0) {
    await appendManifestArtifact({
      kind: "note",
      title: "logo-asset-request-issues",
      status: "observed_local_browser",
      message:
        "تدفّق الإعدادات والرفع اكتمل، لكن المتصفح سجل مشكلات طلبات على أصل الشعار داخل تخزين Supabase (ORB أو إلغاء أثناء تبديل المصدر). هذا finding مستقل على أصل الصورة/تبديلها وليس فشلًا في حفظ الإعدادات أو رفع الشعار.",
    });
    await guards.assertCleanExcept({
      ignoreFailedRequests: [
        /supabase\.co\/storage\/v1\/object\/public\/brand\/logo\/.+net::ERR_(BLOCKED_BY_ORB|ABORTED)/i,
      ],
    });
    return;
  }

  await guards.assertClean();
});
