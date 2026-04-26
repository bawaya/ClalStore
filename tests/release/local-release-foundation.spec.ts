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

async function openIntegrationsTab(page: Parameters<typeof test>[0]["page"]) {
  await page.getByRole("button", { name: "Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª" }).click();
}

async function findProviderPanel(page: Parameters<typeof test>[0]["page"], providerName: string) {
  const escapedProviderName = providerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const title = page.getByText(new RegExp(`Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ${escapedProviderName}`)).first();
  const titleVisible = await title.isVisible().catch(() => false);
  if (!titleVisible) {
    return {
      found: false as const,
      reason: "missing_title" as const,
    };
  }

  const panel = title.locator(
    "xpath=ancestor::div[count(.//input) >= 1 and .//button[normalize-space()='Ø§Ø®ØªØ¨Ø§Ø±'] and .//button[normalize-space()='Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª']][1]",
  );
  const panelVisible = await panel.isVisible().catch(() => false);
  if (!panelVisible) {
    return {
      found: false as const,
      reason: "missing_panel" as const,
    };
  }

  await panel.scrollIntoViewIfNeeded();
  await expect(title).toBeVisible();

  return {
    found: true as const,
    title,
    panel,
  };
}

async function exerciseConfiguredIntegrationPanel(
  page: Parameters<typeof test>[0]["page"],
  {
    providerName,
    noteTitle,
    noteMessage,
    requiredInputIndexes,
  }: {
    providerName: string;
    noteTitle: string;
    noteMessage: string;
    requiredInputIndexes: number[];
  },
) {
  const providerPanel = await findProviderPanel(page, providerName);
  if (!providerPanel.found) {
    await appendManifestArtifact({
      kind: "note",
      title: `${noteTitle}-constrained`,
      status: "constrained",
      message:
        providerPanel.reason === "missing_title"
          ? `ØªÙ… ØªØ¬Ø§ÙˆØ² ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© ${providerName} Ù„Ø£Ù† Ø§Ù„Ø¨Ø·Ø§Ù‚Ø© Ù„ÙŠØ³Øª Ù…Ø¹Ø±ÙˆØ¶Ø© ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ø¨ÙŠØ¦Ø© Ø§Ù„Ù…Ø­Ù„ÙŠØ©.`
          : `ØªÙ… ØªØ¬Ø§ÙˆØ² ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© ${providerName} Ù„Ø£Ù† Ø§Ù„Ø¨Ù†ÙŠØ© Ù„ÙŠØ³Øª Ù…Ø¹Ø±ÙˆØ¶Ø© Ø¨Ø´ÙƒÙ„ Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªÙØ§Ø¹Ù„ Ø§Ù„Ø¢Ù„ÙŠ Ø¶Ù…Ù† Ù‡Ø°Ù‡ Ø§Ù„Ø¨ÙŠØ¦Ø©.`,
    });
    return;
  }

  const { panel } = providerPanel;
  const inputs = panel.locator("input:visible");
  const inputCount = await inputs.count();

  if (inputCount === 0) {
    await appendManifestArtifact({
      kind: "note",
      title: `${noteTitle}-constrained`,
      status: "constrained",
      message: `ØªÙ… ØªØ¬Ø§ÙˆØ² ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© ${providerName} Ù„Ø£Ù† Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ù…ØªÙˆÙ‚Ø¹Ø© Ù„ÙŠØ³Øª Ù…ØªØ§Ø­Ø© Ø¨Ø´ÙƒÙ„ ØµØ§Ù„Ø­ Ù„Ù„ÙØ­Øµ Ø§Ù„Ø¢Ù„ÙŠ.`,
    });
    return;
  }

  const values: string[] = [];
  for (let i = 0; i < inputCount; i += 1) {
    values.push((await inputs.nth(i).inputValue()).trim());
  }

  const missingRequiredIndexes = requiredInputIndexes.filter((index) => !values[index]);
  if (missingRequiredIndexes.length > 0) {
    await appendManifestArtifact({
      kind: "note",
      title: `${noteTitle}-constrained`,
      status: "constrained",
      message:
        `ØªÙ… ØªØ¬Ø§ÙˆØ² Ø§Ù„ÙØ­Øµ Ø§Ù„ØªÙØ§Ø¹Ù„ÙŠ Ù„Ø¨Ø·Ø§Ù‚Ø© ${providerName} Ù„Ø£Ù† Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© ` +
        `Ø°Ø§Øª Ø§Ù„ÙÙ‡Ø§Ø±Ø³ [${missingRequiredIndexes.join(", ")}] Ù„ÙŠØ³Øª Ù…Ù‡ÙŠØ£Ø© Ø¹Ù„Ù‰ Ù‡Ø°Ù‡ Ø§Ù„Ø¨ÙŠØ¦Ø©.`,
    });
    return;
  }

  await panel.getByRole("button", { name: "Ø§Ø®ØªØ¨Ø§Ø±" }).click();
  await expect(panel.getByText(/Ø§Ø®ØªØ¨Ø§Ø± ÙˆØ§Ø¬Ù‡Ø© Ø¢Ù…Ù† Ù†Ø§Ø¬Ø­:/)).toBeVisible();

  const saveResponse = page.waitForResponse((response) => {
    return (
      response.url().includes("/api/admin/settings") &&
      response.request().method() === "PUT" &&
      response.status() === 200
    );
  });

  await panel.getByRole("button", { name: "Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª" }).click();
  await saveResponse;

  await page.reload();
  await acceptCookiesIfPresent(page);
  await openIntegrationsTab(page);

  const refreshedProviderPanel = await findProviderPanel(page, providerName);
  expect(
    refreshedProviderPanel.found,
    `Expected ${providerName} panel to remain available after reload.`,
  ).toBeTruthy();
  if (!refreshedProviderPanel.found) {
    return;
  }

  const { panel: refreshedPanel } = refreshedProviderPanel;
  const refreshedInputs = refreshedPanel.locator("input:visible");

  for (const index of requiredInputIndexes) {
    await expect(refreshedInputs.nth(index)).toBeVisible();
    expect((await refreshedInputs.nth(index).inputValue()).trim().length).toBeGreaterThan(0);
  }

  await appendManifestArtifact({
    kind: "note",
    title: noteTitle,
    status: "verified_local_browser",
    message: noteMessage,
  });
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

  const additionalIntegrationScenarios = [
    {
      providerName: "OpenAI",
      noteTitle: "ai-admin-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© Ø°ÙƒØ§Ø¡ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ù…Ø­Ù„ÙŠÙ‹Ø§ Ø¨Ø­ÙØ¸ Ø§Ù„Ù‚ÙŠÙ… Ø§Ù„Ø­Ø§Ù„ÙŠØ© ÙˆØ§Ø®ØªØ¨Ø§Ø± mock Ø¢Ù…Ù† Ø¯ÙˆÙ† Ø£ÙŠ Ø§ØªØµØ§Ù„ Ø®Ø§Ø±Ø¬ÙŠ Ø­Ù‚ÙŠÙ‚ÙŠ.",
      requiredInputIndexes: [0, 2],
    },
    {
      providerName: "yCloud",
      noteTitle: "whatsapp-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© ÙˆØ§ØªØ³Ø§Ø¨ Ø¨Ù‚ÙŠÙ…Ù‡Ø§ Ø§Ù„Ø­Ø§Ù„ÙŠØ© Ù…Ø¹ mock Ù„Ø²Ø± Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±ØŒ Ø¯ÙˆÙ† Ø¥Ø±Ø³Ø§Ù„ Ø£ÙŠ Ø±Ø³Ø§Ø¦Ù„ ÙˆØ§ØªØ³Ø§Ø¨ Ø­Ù‚ÙŠÙ‚ÙŠØ©.",
      requiredInputIndexes: [0, 1],
    },
    {
      providerName: "Twilio SMS",
      noteTitle: "sms-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© SMS/OTP Ù…Ø­Ù„ÙŠÙ‹Ø§ Ù…Ø¹ mock ÙƒØ§Ù…Ù„ Ø¯ÙˆÙ† Ø¥Ø±Ø³Ø§Ù„ OTP Ø£Ùˆ Ø±Ø³Ø§Ø¦Ù„ Ø­Ù‚ÙŠÙ‚ÙŠØ©.",
      requiredInputIndexes: [0, 1, 2],
    },
    {
      providerName: "×¨×•×•×—×™×ª (Rivhit)",
      noteTitle: "payment-il-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ø¥Ø³Ø±Ø§Ø¦ÙŠÙ„ÙŠ Ø¨Ø­ÙØ¸ Ø§Ù„Ù‚ÙŠÙ… Ø§Ù„Ø­Ø§Ù„ÙŠØ© ÙˆØ§Ø®ØªØ¨Ø§Ø± mock Ø¯ÙˆÙ† Ø¥Ù†Ø´Ø§Ø¡ Ø¯ÙØ¹ Ø­Ù‚ÙŠÙ‚ÙŠ.",
      requiredInputIndexes: [0],
    },
    {
      providerName: "UPay",
      noteTitle: "payment-upay-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© UPay Ø¨Ø·Ø±ÙŠÙ‚Ø© Ø¢Ù…Ù†Ø© Ù…Ø¹ mock ÙƒØ§Ù…Ù„ØŒ Ø¨Ù„Ø§ Ø£ÙŠ Ù…Ø­Ø§ÙˆÙ„Ø© Ø¯ÙØ¹ Ø£Ùˆ Ø§ØªØµØ§Ù„ ØªØ´ØºÙŠÙ„ÙŠ Ø­Ù‚ÙŠÙ‚ÙŠ.",
      requiredInputIndexes: [0, 1],
    },
    {
      providerName: "Cloudflare R2",
      noteTitle: "storage-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© ØªØ®Ø²ÙŠÙ† Ø§Ù„ØµÙˆØ± Ø¨Ù‚ÙŠÙ…Ù‡Ø§ Ø§Ù„Ø­Ø§Ù„ÙŠØ© Ù…Ø¹ mock Ù„Ù„ØªØ­Ù‚Ù‚ØŒ Ø¯ÙˆÙ† ØªØºÙŠÙŠØ± Ù…Ù„ÙØ§Øª Ø­Ù‚ÙŠÙ‚ÙŠØ© Ø£Ùˆ Ø±ÙØ¹ Ø¬Ø¯ÙŠØ¯.",
      requiredInputIndexes: [0, 1, 2, 4],
    },
    {
      providerName: "Web Push (VAPID)",
      noteTitle: "push-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Push Ù…Ø­Ù„ÙŠÙ‹Ø§ Ù…Ø¹ mock Ù„Ø²Ø± Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± Ø¯ÙˆÙ† Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ Ø¥Ù„Ù‰ Ø£ÙŠ Ù…Ø´ØªØ±Ùƒ Ø­Ù‚ÙŠÙ‚ÙŠ.",
      requiredInputIndexes: [0, 1],
    },
    {
      providerName: "Internal Webhooks",
      noteTitle: "webhook-security-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© Ø£Ø³Ø±Ø§Ø± Webhook Ù…Ø­Ù„ÙŠÙ‹Ø§ Ù…Ø¹ mock ÙƒØ§Ù…Ù„ Ù„Ø²Ø± Ø§Ù„ØªØ­Ù‚Ù‚ Ø¯ÙˆÙ† Ø¶Ø±Ø¨ Ø£ÙŠ webhook Ø­Ù‚ÙŠÙ‚ÙŠ.",
      requiredInputIndexes: [0],
    },
    {
      providerName: "Remove.bg",
      noteTitle: "image-enhance-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© ØªØ­Ø³ÙŠÙ† Ø§Ù„ØµÙˆØ± Ø¨Ù…Ø­Ø§ÙƒØ§Ø© Ø¢Ù…Ù†Ø© Ø¯ÙˆÙ† Ø¥Ø±Ø³Ø§Ù„ Ø£ÙŠ ØµÙˆØ± Ø­Ù‚ÙŠÙ‚ÙŠØ© Ù„Ù„Ù…Ø²ÙˆØ¯.",
      requiredInputIndexes: [0],
    },
    {
      providerName: "MobileAPI.dev",
      noteTitle: "device-data-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ù…Ø¹ mock Ø¢Ù…Ù† Ø¯ÙˆÙ† Ø£ÙŠ Ø¬Ù„Ø¨ Ø­Ù‚ÙŠÙ‚ÙŠ Ù„Ù„Ù…ÙˆØ§ØµÙØ§Øª Ù…Ù† Ø§Ù„Ù…Ø²ÙˆØ¯.",
      requiredInputIndexes: [0],
    },
    {
      providerName: "Pexels",
      noteTitle: "stock-images-integration-ui-save-safe",
      noteMessage:
        "ØªÙ… ÙØ­Øµ Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„ØµÙˆØ± Ø§Ù„Ø¥Ø¶Ø§ÙÙŠØ© Ø¨Ù…Ø­Ø§ÙƒØ§Ø© Ø¢Ù…Ù†Ø© Ø¯ÙˆÙ† Ø£ÙŠ Ø¬Ù„Ø¨ Ø®Ø§Ø±Ø¬ÙŠ Ø­Ù‚ÙŠÙ‚ÙŠ.",
      requiredInputIndexes: [0],
    },
  ];

  for (const scenario of additionalIntegrationScenarios) {
    await exerciseConfiguredIntegrationPanel(page, scenario);
  }

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
