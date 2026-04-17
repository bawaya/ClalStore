import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callClaude, cleanAlternatingMessages } from "@/lib/ai/claude";

// ─── callClaude ───────────────────────────────────────────────────

describe("callClaude", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns text and tokens on success", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: "مرحبا! كيف أقدر أساعدك?" }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
    });

    const result = await callClaude({
      systemPrompt: "You are a helpful assistant.",
      messages: [{ role: "user", content: "مرحبا" }],
    });

    expect(result).not.toBeNull();
    expect(result!.text).toBe("مرحبا! كيف أقدر أساعدك?");
    expect(result!.tokens.input).toBe(100);
    expect(result!.tokens.output).toBe(50);
    expect(result!.duration).toBeGreaterThanOrEqual(0);
  });

  it("sends correct headers and body", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "ok" }], usage: {} }),
    });

    await callClaude({
      systemPrompt: "test system",
      messages: [{ role: "user", content: "test" }],
      maxTokens: 200,
      temperature: 0.5,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options.method).toBe("POST");
    expect(options.headers["x-api-key"]).toBe("test-api-key");
    expect(options.headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(options.body);
    expect(body.max_tokens).toBe(200);
    expect(body.temperature).toBe(0.5);
    expect(body.system).toBe("test system");
    expect(body.messages).toEqual([{ role: "user", content: "test" }]);
  });

  it("returns null when no API key is available", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await callClaude({
      systemPrompt: "test",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses provided apiKey over env variable", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "ok" }], usage: {} }),
    });

    await callClaude({
      systemPrompt: "test",
      messages: [{ role: "user", content: "test" }],
      apiKey: "custom-key",
    });

    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers["x-api-key"]).toBe("custom-key");
  });

  it("returns null on HTTP error", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const result = await callClaude({
      systemPrompt: "test",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));

    const result = await callClaude({
      systemPrompt: "test",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result).toBeNull();
  });

  describe("JSON mode", () => {
    it("appends JSON instruction to system prompt", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: '{"intent": "buy", "confidence": 0.9}' }],
            usage: {},
          }),
      });

      await callClaude({
        systemPrompt: "Classify intent",
        messages: [{ role: "user", content: "بدي ايفون" }],
        jsonMode: true,
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.system).toContain("JSON");
    });

    it("parses JSON response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: '{"intent": "buy", "confidence": 0.9}' }],
            usage: {},
          }),
      });

      const result = await callClaude({
        systemPrompt: "Classify",
        messages: [{ role: "user", content: "test" }],
        jsonMode: true,
      });

      expect(result).not.toBeNull();
      expect(result!.json).toBeDefined();
      expect(result!.json!.intent).toBe("buy");
      expect(result!.json!.confidence).toBe(0.9);
    });

    it("handles JSON wrapped in markdown code blocks", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: '```json\n{"result": true}\n```' }],
            usage: {},
          }),
      });

      const result = await callClaude({
        systemPrompt: "test",
        messages: [{ role: "user", content: "test" }],
        jsonMode: true,
      });

      expect(result!.json).toEqual({ result: true });
    });

    it("returns raw text when JSON parse fails", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: "not valid json" }],
            usage: {},
          }),
      });

      const result = await callClaude({
        systemPrompt: "test",
        messages: [{ role: "user", content: "test" }],
        jsonMode: true,
      });

      expect(result).not.toBeNull();
      expect(result!.text).toBe("not valid json");
      expect(result!.json).toBeUndefined();
    });
  });

  it("uses default maxTokens and temperature when not specified", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "ok" }], usage: {} }),
    });

    await callClaude({
      systemPrompt: "test",
      messages: [{ role: "user", content: "test" }],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(500);
    expect(body.temperature).toBe(0.7);
  });
});

// ─── cleanAlternatingMessages ─────────────────────────────────────

describe("cleanAlternatingMessages", () => {
  it("returns default user message for empty array", () => {
    const result = cleanAlternatingMessages([]);
    expect(result).toEqual([{ role: "user", content: "مرحبا" }]);
  });

  it("merges consecutive same-role messages", () => {
    const result = cleanAlternatingMessages([
      { role: "user", content: "hello" },
      { role: "user", content: "world" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("hello\nworld");
    expect(result[0].role).toBe("user");
  });

  it("preserves already alternating messages", () => {
    const messages = [
      { role: "user" as const, content: "hello" },
      { role: "assistant" as const, content: "hi" },
      { role: "user" as const, content: "how are you" },
    ];
    const result = cleanAlternatingMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("user");
  });

  it("prepends user message if first message is assistant", () => {
    const result = cleanAlternatingMessages([
      { role: "assistant", content: "مرحبا بك" },
      { role: "user", content: "شكرا" },
    ]);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("مرحبا");
    expect(result[1].role).toBe("assistant");
  });

  it("appends user message if last message is assistant", () => {
    const result = cleanAlternatingMessages([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ]);
    expect(result[result.length - 1].role).toBe("user");
    expect(result[result.length - 1].content).toBe("...");
  });

  it("handles complex scenario with multiple consecutive same-role messages", () => {
    const result = cleanAlternatingMessages([
      { role: "user", content: "a" },
      { role: "user", content: "b" },
      { role: "assistant", content: "c" },
      { role: "assistant", content: "d" },
      { role: "user", content: "e" },
    ]);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("a\nb");
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toBe("c\nd");
    expect(result[2].role).toBe("user");
    expect(result[2].content).toBe("e");
  });

  it("does not mutate the original messages", () => {
    const messages = [
      { role: "user" as const, content: "hello" },
      { role: "user" as const, content: "world" },
    ];
    const copy = messages.map((m) => ({ ...m }));
    cleanAlternatingMessages(messages);
    expect(messages).toEqual(copy);
  });
});
