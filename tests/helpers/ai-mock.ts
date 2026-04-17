/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ───── Claude / Anthropic ─────

export const claudeMockResponse = {
  text: "This is a mock AI response for testing.",
  json: { answer: "mock", confidence: 0.95 },
  tokens: { input: 100, output: 50 },
  duration: 1200,
};

export function makeClaudeResponse(overrides: Partial<typeof claudeMockResponse> = {}) {
  return { ...claudeMockResponse, ...overrides };
}

// ───── Gemini ─────

export const geminiMockResponse = {
  text: "Gemini mock response for testing.",
  json: { answer: "gemini-mock", confidence: 0.9 },
  tokens: { input: 80, output: 40 },
  duration: 800,
};

export function makeGeminiResponse(overrides: Partial<typeof geminiMockResponse> = {}) {
  return { ...geminiMockResponse, ...overrides };
}

// ───── OpenAI (if used) ─────

export const openaiMockResponse = {
  text: "OpenAI mock response.",
  json: null,
  tokens: { input: 90, output: 45 },
  duration: 1000,
};

// ───── Error responses ─────

export const aiErrorResponse = null; // callClaude / callGemini return null on error

export const aiRateLimitError = {
  status: 429,
  message: "Rate limit exceeded",
};

// ───── Install AI fetch mock ─────

export function installAIFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: any) => {
    const urlStr = typeof url === "string" ? url : "";

    // Anthropic / Claude
    if (urlStr.includes("anthropic") || urlStr.includes("claude")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: "text", text: claudeMockResponse.text }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      };
    }

    // Gemini
    if (urlStr.includes("generativelanguage") || urlStr.includes("gemini")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: geminiMockResponse.text }] } }],
          usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40 },
        }),
      };
    }

    // OpenAI
    if (urlStr.includes("openai")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: openaiMockResponse.text } }],
          usage: { prompt_tokens: 90, completion_tokens: 45 },
        }),
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
