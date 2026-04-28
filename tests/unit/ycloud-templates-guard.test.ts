import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readMockOutbound } from "@/lib/outbound-mock";

vi.mock("@/lib/integrations/hub", () => ({
  getIntegrationConfig: vi.fn(async () => ({})),
}));

let tempDir: string;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "yc-templates-guard-"));
  vi.stubEnv("MOCK_OUTBOUND_LOG_DIR", tempDir);
  vi.stubEnv("MOCK_OUTBOUND", "true");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("YCLOUD_API_KEY", "yc_realProductionKey1234567890");
  vi.stubEnv("ALLOW_TEMPLATE_MUTATIONS", "");

  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ status: "PENDING" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
  await fs.rm(tempDir, { recursive: true, force: true });
});

const SAMPLE_TEMPLATE = {
  name: "test_template",
  category: "UTILITY",
  language: "ar",
  components: [{ type: "BODY", text: "hello {{1}}" }],
};

describe("ycloud-templates — createTemplate guard", () => {
  it("records intent + returns mock-success without fetch when blocked", async () => {
    const { createTemplate } = await import("@/lib/integrations/ycloud-templates");
    const result = await createTemplate(SAMPLE_TEMPLATE);

    expect(result.success).toBe(true);
    expect(result.status).toBe("PENDING_MOCKED");
    expect(fetchSpy).not.toHaveBeenCalled();

    const [entry] = await readMockOutbound();
    expect(entry.channel).toBe("whatsapp_template");
    expect(entry.to).toBe("test_template");
    expect(entry.meta?.type).toBe("create_template");
    expect((entry.meta?.template as { name: string }).name).toBe("test_template");
  });

  it("refuses without ALLOW_TEMPLATE_MUTATIONS even with a real prod key", async () => {
    // Disable layer 1 so we exercise layer 2.
    vi.unstubAllEnvs();
    vi.stubEnv("MOCK_OUTBOUND", "");
    vi.stubEnv("ALLOW_REAL_OUTBOUND", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("YCLOUD_API_KEY", "yc_realProductionKey1234567890");

    const { createTemplate } = await import("@/lib/integrations/ycloud-templates");
    const result = await createTemplate(SAMPLE_TEMPLATE);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ALLOW_TEMPLATE_MUTATIONS/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("ycloud-templates — deleteTemplate guard", () => {
  it("records intent + returns success without fetch when blocked", async () => {
    const { deleteTemplate } = await import("@/lib/integrations/ycloud-templates");
    const result = await deleteTemplate("doomed_template");

    expect(result).toEqual({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    const [entry] = await readMockOutbound();
    expect(entry.channel).toBe("whatsapp_template");
    expect(entry.meta?.type).toBe("delete_template");
    expect(entry.meta?.templateName).toBe("doomed_template");
  });

  it("refuses without ALLOW_TEMPLATE_MUTATIONS even when guard would otherwise allow", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("YCLOUD_API_KEY", "yc_realProductionKey1234567890");

    const { deleteTemplate } = await import("@/lib/integrations/ycloud-templates");
    const result = await deleteTemplate("any_template");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ALLOW_TEMPLATE_MUTATIONS/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("ycloud-templates — provisionRequiredTemplates guard", () => {
  it("records the planned-template list and returns one mock result per template", async () => {
    const { provisionRequiredTemplates, REQUIRED_TEMPLATES } = await import(
      "@/lib/integrations/ycloud-templates"
    );
    const expected = REQUIRED_TEMPLATES.map((t) => t.name);

    const result = await provisionRequiredTemplates();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(expected.length);
    for (const r of result.results) {
      expect(r.status).toBe("PENDING_MOCKED");
      expect(expected).toContain(r.name);
    }

    const [entry] = await readMockOutbound();
    expect(entry.channel).toBe("whatsapp_template");
    expect(entry.meta?.type).toBe("provision");
    expect(entry.meta?.plannedNames).toEqual(expected);
  });
});
