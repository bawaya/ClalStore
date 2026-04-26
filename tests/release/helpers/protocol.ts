import fs from "node:fs/promises";
import path from "node:path";
import { expect, Page } from "@playwright/test";

type ManifestArtifact = Record<string, unknown>;
const baseOrigin = (() => {
  const raw = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3101";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://127.0.0.1:3101";
  }
})();

function manifestPathFromEnv() {
  return process.env.TEST_MANIFEST_PATH || "";
}

export async function appendManifestArtifact(artifact: ManifestArtifact) {
  const manifestPath = manifestPathFromEnv();
  if (!manifestPath) return;

  const resolved = path.isAbsolute(manifestPath)
    ? manifestPath
    : path.join(process.cwd(), manifestPath);
  const raw = await fs.readFile(resolved, "utf8");
  const manifest = JSON.parse(raw);
  manifest.artifacts.push({
    id: `${manifest.runId}_${manifest.artifacts.length + 1}`,
    recordedAt: new Date().toISOString(),
    ...artifact,
  });
  await fs.writeFile(resolved, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function attachPageGuards(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!/favicon|chrome-extension|ERR_BLOCKED_BY_CLIENT/i.test(text)) {
        const location = msg.location();
        const locationHint = location?.url ? ` @ ${location.url}` : "";
        consoleErrors.push(`${text}${locationHint}`);
      }
    }
  });

  page.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText || "unknown";
    const url = request.url();
    const method = request.method();

    if (
      /net::ERR_ABORTED/i.test(failureText) &&
      method === "GET" &&
      /[?&]_rsc=/.test(url)
    ) {
      return;
    }

    failedRequests.push(`${method} ${url} :: ${failureText}`);
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    let isSameOrigin = false;
    try {
      isSameOrigin = new URL(url).origin === baseOrigin;
    } catch {
      isSameOrigin = false;
    }

    if (isSameOrigin && status >= 400 && !/\/api\/auth\/change-password/.test(url)) {
      failedResponses.push(`${status} ${response.request().method()} ${url}`);
    }
  });

  return {
    snapshot() {
      return {
        pageErrors: [...pageErrors],
        consoleErrors: [...consoleErrors],
        failedResponses: [...failedResponses],
        failedRequests: [...failedRequests],
      };
    },
    async assertClean() {
      expect(pageErrors, `page errors:\n${pageErrors.join("\n")}`).toEqual([]);
      expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
      expect(failedResponses, `failed responses:\n${failedResponses.join("\n")}`).toEqual([]);
      expect(failedRequests, `failed requests:\n${failedRequests.join("\n")}`).toEqual([]);
    },
    async assertCleanExcept(options?: { ignoreFailedRequests?: RegExp[] }) {
      const ignoreFailedRequests = options?.ignoreFailedRequests || [];
      const relevantFailedRequests = failedRequests.filter((entry) => {
        return !ignoreFailedRequests.some((pattern) => pattern.test(entry));
      });

      expect(pageErrors, `page errors:\n${pageErrors.join("\n")}`).toEqual([]);
      expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
      expect(failedResponses, `failed responses:\n${failedResponses.join("\n")}`).toEqual([]);
      expect(
        relevantFailedRequests,
        `failed requests:\n${relevantFailedRequests.join("\n")}`,
      ).toEqual([]);
    },
  };
}

export async function findInputByLabel(page: Page, label: string) {
  const associated = page.getByLabel(label, { exact: true }).first();
  if (await associated.count()) {
    await expect(associated).toBeVisible();
    return associated;
  }

  const labelLocator = page.locator("label", { hasText: label }).first();
  await expect(labelLocator).toBeVisible();
  const parent = labelLocator.locator("xpath=..");
  const control = parent.locator("input, textarea, select").first();
  await expect(control).toBeVisible();
  return control;
}
