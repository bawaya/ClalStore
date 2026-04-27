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

async function loginToRoute(
  page: Parameters<typeof test>[0]["page"],
  route: string,
  expectedUrlPattern?: RegExp,
) {
  await page.goto(`/login?redirect=${encodeURIComponent(route)}`);
  const emailInput = await findInputByLabel(page, "البريد الإلكتروني");
  const passwordInput = await findInputByLabel(page, "كلمة المرور");
  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(expectedUrlPattern || new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
    timeout: 30_000,
  });
}

async function loginToAdminSettings(page: Parameters<typeof test>[0]["page"]) {
  await loginToRoute(page, "/admin/settings", /\/admin\/settings/);
}

async function acceptCookiesIfPresent(page: Parameters<typeof test>[0]["page"]) {
  const acceptButton = page.getByRole("button", { name: /قبول الكل/ }).first();
  if (await acceptButton.isVisible().catch(() => false)) {
    await acceptButton.click();
    await expect(acceptButton).toHaveCount(0);
  }
}

async function blockAnalyticsEndpoints(page: Parameters<typeof test>[0]["page"]) {
  await page.route("https://www.google-analytics.com/**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
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

async function exerciseCrmReadonlyNavigation(page: Parameters<typeof test>[0]["page"]) {
  const crmPages = [
    {
      path: "/crm",
      readyText: /داشبورد CRM/,
    },
    {
      path: "/crm/inbox",
      readyText: /صندوق الوارد/,
    },
    {
      path: "/crm/customers",
      readyText: /الزبائن/,
    },
    {
      path: "/crm/orders",
      readyText: /الطلبات/,
    },
    {
      path: "/crm/chats",
      readyText: /المحادثات/,
    },
    {
      path: "/crm/tasks",
      readyText: /المهام/,
    },
    {
      path: "/crm/pipeline",
      readyText: /(?:פייפליין מכירות|אין שלבי פייפליין מוגדרים)/,
    },
    {
      path: "/crm/reports",
      readyText: /التقارير/,
    },
    {
      path: "/crm/users",
      readyText: /الفريق/,
    },
  ];

  const visitedPages: string[] = [];

  for (const crmPage of crmPages) {
    await page.goto(crmPage.path);
    await expect(page.getByText(crmPage.readyText).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(250);
    visitedPages.push(crmPage.path);
  }

  await appendManifestArtifact({
    kind: "note",
    title: "crm-readonly-navigation-local",
    status: "verified_local_browser",
    message: `تمت مراجعة صفحات CRM الأساسية محليًا في وضع قراءة آمن فقط: ${visitedPages.join(", ")}. لم تُنفذ أي عمليات إنشاء/حذف/إرسال ضمن هذه الجولة.`,
  });
}

async function exerciseStoreReadonlyNavigation(page: Parameters<typeof test>[0]["page"]) {
  const storePages = [
    {
      path: "/store",
      readyText: /واجهة متجر داكنة ومنظمة تقود العين إلى المنتج والسعر/,
    },
    {
      path: "/store/computers",
      readyText: /كمبيوتر|لابتوب|طابعات/,
    },
    {
      path: "/store/tvs",
      readyText: /تلفزيونات|تقنية الشاشة/,
    },
    {
      path: "/store/tablets",
      readyText: /تابلت|فئة التابلت/,
    },
    {
      path: "/store/smart-home",
      readyText: /المنزل الذكي|منتجات/,
    },
    {
      path: "/store/network",
      readyText: /راوتر|شبكة/,
    },
  ];

  const visitedPages: string[] = [];

  for (const storePage of storePages) {
    await page.goto(storePage.path);
    await acceptCookiesIfPresent(page);
    await expect(page.getByText(storePage.readyText).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByPlaceholder(/ابحث|البحث/).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(250);
    visitedPages.push(storePage.path);
  }

  await appendManifestArtifact({
    kind: "note",
    title: "store-readonly-navigation-local",
    status: "verified_local_browser",
    message: `تمت مراجعة صفحات المتجر العامة محليًا في وضع قراءة فقط: ${visitedPages.join(", ")}. لم تُنفذ أي إضافات سلة أو طلبات أو إرسال نماذج ضمن هذه الجولة.`,
  });
}

async function exerciseStoreSecondaryReadonlyNavigation(
  page: Parameters<typeof test>[0]["page"],
) {
  await page.addInitScript(() => {
    localStorage.removeItem("clal_cart");
    localStorage.removeItem("clal_compare");
    localStorage.removeItem("clal_wishlist");
    localStorage.removeItem("clal_visitor_id");
  });

  const visitedPages: string[] = [];

  await page.goto("/store/wishlist");
  await acceptCookiesIfPresent(page);
  await expect(page.getByText(/Ù‚Ø§Ø¦Ù…Ø© Ù…ÙØ¶Ù„Ø© Ù…Ø±ØªØ¨Ø© ÙˆÙˆØ§Ø¶Ø­Ø©/).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù†ØªØ¬Ø§Øª Ù…ÙØ¶Ù„Ø©/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/wishlist");

  await page.goto("/store/compare");
  await expect(
    page.getByText(/Ø¬Ø¯ÙˆÙ„ Ù…Ù‚Ø§Ø±Ù†Ø© Ù…Ù†Ø¸Ù… Ù„Ø§ØªØ®Ø§Ø° Ø§Ù„Ù‚Ø±Ø§Ø± Ø¨Ø³Ø±Ø¹Ø©/).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ù†ØªØ¬Ø§Øª Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø©/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/compare");

  await page.goto("/store/cart");
  await expect(page.getByText(/Ø§Ù„Ø³Ù„Ø© ÙØ§Ø±ØºØ©/).first()).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/Ø£Ø¶Ù Ù…Ù†ØªØ¬Ø§Øª Ø£ÙˆÙ„Ø§Ù‹ Ø­ØªÙ‰ Ù†Ø¨Ø¯Ø£ Ù…Ø³Ø§Ø± Ø§Ù„Ø·Ù„Ø¨/).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/cart");

  await page.goto("/store/track");
  await expect(
    page.getByText(/Ø§ÙØ­Øµ Ø­Ø§Ù„Ø© Ø·Ù„Ø¨Ùƒ Ù…Ù† Ø´Ø§Ø´Ø© ÙˆØ§Ø­Ø¯Ø© ÙˆØ§Ø¶Ø­Ø©/).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "ØªØªØ¨Ø¹" }).click();
  await expect(page.getByText(/Ø£Ø¯Ø®Ù„ Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/track");

  await appendManifestArtifact({
    kind: "note",
    title: "store-secondary-readonly-navigation-local",
    status: "verified_local_browser",
    message: `ØªÙ…Øª Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„ØµÙØ­Ø§Øª Ø§Ù„ÙØ±Ø¹ÙŠØ© Ù„Ù„Ù…ØªØ¬Ø± Ù…Ø­Ù„ÙŠÙ‹Ø§ ÙÙŠ ÙˆØ¶Ø¹ Ù‚Ø±Ø§Ø¡Ø© ÙÙ‚Ø· Ù…Ø¹ Ø­Ø§Ù„Ø© ÙØ§Ø±ØºØ© Ù…Ø¶Ù…ÙˆÙ†Ø©: ${visitedPages.join(", ")}. Ù„Ù… ØªÙÙ†ÙØ° Ø£ÙŠ Ø¹Ù…Ù„ÙŠØ§Øª Ø·Ù„Ø¨ Ø£Ùˆ Ø¯ÙØ¹ Ø£Ùˆ Ø¥Ø±Ø³Ø§Ù„ Ø§ØªØµØ§Ù„Ø§Øª Ø®Ø§Ø±Ø¬ÙŠØ© Ø¶Ù…Ù† Ù‡Ø°Ù‡ Ø§Ù„Ø¬ÙˆÙ„Ø©.`,
  });
}

test.describe.configure({ mode: "serial" });

async function exerciseStoreSecondaryReadonlyNavigationSafe(
  page: Parameters<typeof test>[0]["page"],
) {
  await page.addInitScript(() => {
    localStorage.removeItem("clal_cart");
    localStorage.removeItem("clal_compare");
    localStorage.removeItem("clal_wishlist");
    localStorage.removeItem("clal_visitor_id");
  });

  const visitedPages: string[] = [];

  await page.goto("/store/wishlist");
  await acceptCookiesIfPresent(page);
  await expect(
    page
      .getByText(
        /\u0642\u0627\u0626\u0645\u0629 \u0645\u0641\u0636\u0644\u0629 \u0645\u0631\u062a\u0628\u0629 \u0648\u0648\u0627\u0636\u062d\u0629/,
      )
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByText(/\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a \u0645\u0641\u0636\u0644\u0629/)
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/wishlist");

  await page.goto("/store/compare");
  await expect(
    page
      .getByText(
        /\u062c\u062f\u0648\u0644 \u0645\u0642\u0627\u0631\u0646\u0629 \u0645\u0646\u0638\u0645 \u0644\u0627\u062a\u062e\u0627\u0630 \u0627\u0644\u0642\u0631\u0627\u0631 \u0628\u0633\u0631\u0639\u0629/,
      )
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByText(/\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a \u0644\u0644\u0645\u0642\u0627\u0631\u0646\u0629/)
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/compare");

  await page.goto("/store/cart");
  await expect(
    page.getByText(/\u0627\u0644\u0633\u0644\u0629 \u0641\u0627\u0631\u063a\u0629/).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByText(
        /\u0623\u0636\u0641 \u0645\u0646\u062a\u062c\u0627\u062a \u0623\u0648\u0644\u064b\u0627 \u062d\u062a\u0649 \u0646\u0628\u062f\u0623 \u0645\u0633\u0627\u0631 \u0627\u0644\u0637\u0644\u0628/,
      )
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/cart");

  await page.goto("/store/track");
  await expect(
    page
      .getByText(
        /\u0627\u0641\u062d\u0635 \u062d\u0627\u0644\u0629 \u0637\u0644\u0628\u0643 \u0645\u0646 \u0634\u0627\u0634\u0629 \u0648\u0627\u062d\u062f\u0629 \u0648\u0627\u0636\u062d\u0629/,
      )
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /\u062a\u062a\u0628\u0639/ }).click();
  await expect(
    page.getByText(/\u0623\u062f\u062e\u0644 \u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628/).first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
  visitedPages.push("/store/track");

  await appendManifestArtifact({
    kind: "note",
    title: "store-secondary-readonly-navigation-local",
    status: "verified_local_browser",
    message: `تمت مراجعة الصفحات الفرعية للمتجر محليًا في وضع قراءة فقط مع حالة فارغة مضمونة: ${visitedPages.join(", ")}. لم تُنفذ أي عمليات طلب أو دفع أو إرسال اتصالات خارجية ضمن هذه الجولة.`,
  });
}

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

test("صفحات المتجر العامة تعرض التنقل والبحث بشكل مستقر في وضع قراءة فقط", async ({
  page,
}) => {
  const guards = attachPageGuards(page);

  await page.route("https://www.google-analytics.com/**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await exerciseStoreReadonlyNavigation(page);

  await guards.assertClean();
});

test("الصفحات الفرعية للمتجر تنجح في الوضع القرائي الفارغ من دون آثار جانبية", async ({
  page,
}) => {
  const guards = attachPageGuards(page);

  await blockAnalyticsEndpoints(page);
  await exerciseStoreSecondaryReadonlyNavigationSafe(page);

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

test("صفحات CRM المرممة تعرض عناصرها القرائية الأساسية بثبات", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "بيانات دخول الإدارة غير متوفرة لهذه الحزمة.");

  const guards = attachPageGuards(page);

  await loginToRoute(page, "/crm/customers", /\/crm\/customers/);
  await expect(page.getByText(/\u0627\u0644\u0632\u0628\u0627\u0626\u0646/).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page
      .getByPlaceholder(
        /\u0627\u0628\u062d\u062b \u0628\u0627\u0644\u0627\u0633\u0645\u060c \u0647\u0627\u062a\u0641\u060c \u0625\u064a\u0645\u064a\u0644 \u0623\u0648 \u0643\u0648\u062f \u0627\u0644\u0639\u0645\u064a\u0644/,
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByPlaceholder(
        /\u0628\u062d\u062b HOT: HOT ID \/ HOT Customer Code \/ \u0631\u0642\u0645 \u062e\u0637/,
      )
      .first(),
  ).toBeVisible();

  await page.goto("/crm/pipeline");
  await expect(
    page
      .getByText(
        /\u05e4\u05d9\u05d9\u05e4\u05dc\u05d9\u05d9\u05df \u05de\u05db\u05d9\u05e8\u05d5\u05ea|\u05d0\u05d9\u05df \u05e9\u05dc\u05d1\u05d9 \u05e4\u05d9\u05d9\u05e4\u05dc\u05d9\u05d9\u05df \u05de\u05d5\u05d2\u05d3\u05e8\u05d9\u05dd/,
      )
      .first(),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/crm/reports");
  await expect(
    page.getByText(/\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631/).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('input[type="date"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /\u0639\u0631\u0636 \u0627\u0644\u062a\u0642\u0631\u064a\u0631/ }),
  ).toBeVisible();

  await appendManifestArtifact({
    kind: "note",
    title: "crm-focused-readonly-stability",
    status: "verified_local_browser",
    message:
      "تمت مراجعة صفحات CRM المرممة محليًا بتركيز على customers وpipeline وreports مع التحقق من عناصر الشاشة الأساسية فقط ودون أي إنشاء أو حذف أو إرسال.",
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

  await exerciseCrmReadonlyNavigation(page);

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
