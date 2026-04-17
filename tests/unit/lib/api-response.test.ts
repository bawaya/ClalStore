import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: any, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

import { apiSuccess, apiError, errMsg, errDetail, safeError } from "@/lib/api-response";

// ─────────────────────────────────────────────
// apiSuccess
// ─────────────────────────────────────────────
describe("apiSuccess", () => {
  it("returns response with success: true and data", async () => {
    const res = apiSuccess({ orders: [1, 2, 3] });
    const body = await (res as any).json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ orders: [1, 2, 3] });
  });

  it("spreads object data at top level for backward compatibility", async () => {
    const res = apiSuccess({ orders: [1, 2, 3], total: 3 });
    const body = await (res as any).json();
    expect(body.orders).toEqual([1, 2, 3]);
    expect(body.total).toBe(3);
  });

  it("does not spread array data", async () => {
    const res = apiSuccess([1, 2, 3]);
    const body = await (res as any).json();
    expect(body.data).toEqual([1, 2, 3]);
    expect(body[0]).toBeUndefined();
  });

  it("does not spread primitive data", async () => {
    const res = apiSuccess("hello");
    const body = await (res as any).json();
    expect(body.data).toBe("hello");
  });

  it("includes meta when provided", async () => {
    const res = apiSuccess({ items: [] }, { page: 1, limit: 10, total: 100, totalPages: 10 });
    const body = await (res as any).json();
    expect(body.meta).toEqual({ page: 1, limit: 10, total: 100, totalPages: 10 });
  });

  it("does not include meta when not provided", async () => {
    const res = apiSuccess({ items: [] });
    const body = await (res as any).json();
    expect(body.meta).toBeUndefined();
  });

  it("uses default status 200", () => {
    const res = apiSuccess({});
    expect((res as any).status).toBe(200);
  });

  it("accepts custom status code", () => {
    const res = apiSuccess({}, undefined, 201);
    expect((res as any).status).toBe(201);
  });
});

// ─────────────────────────────────────────────
// apiError
// ─────────────────────────────────────────────
describe("apiError", () => {
  it("returns response with success: false and error message", async () => {
    const res = apiError("Something went wrong");
    const body = await (res as any).json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Something went wrong");
  });

  it("uses default status 500", () => {
    const res = apiError("fail");
    expect((res as any).status).toBe(500);
  });

  it("accepts custom status code", () => {
    const res = apiError("Not found", 404);
    expect((res as any).status).toBe(404);
  });

  it("accepts status 400 for bad requests", () => {
    const res = apiError("Bad request", 400);
    expect((res as any).status).toBe(400);
  });

  it("accepts status 401 for unauthorized", () => {
    const res = apiError("Unauthorized", 401);
    expect((res as any).status).toBe(401);
  });
});

// ─────────────────────────────────────────────
// errMsg
// ─────────────────────────────────────────────
describe("errMsg", () => {
  it("returns fallback message for Error instances (hides internals)", () => {
    const err = new Error("DB connection failed");
    expect(errMsg(err)).toBe("Internal server error");
  });

  it("returns fallback message for non-Error values", () => {
    expect(errMsg("some string")).toBe("Internal server error");
    expect(errMsg(42)).toBe("Internal server error");
    expect(errMsg(null)).toBe("Internal server error");
    expect(errMsg(undefined)).toBe("Internal server error");
  });

  it("returns custom fallback when provided", () => {
    const err = new Error("oops");
    expect(errMsg(err, "Custom error")).toBe("Custom error");
  });

  it("logs the error message for Error instances", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errMsg(new Error("secret DB error"));
    expect(consoleSpy).toHaveBeenCalledWith("[API Error]", "secret DB error");
    consoleSpy.mockRestore();
  });

  it("does not log for non-Error values", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errMsg("plain string");
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────
// errDetail
// ─────────────────────────────────────────────
describe("errDetail", () => {
  it("returns the actual error message for Error instances", () => {
    expect(errDetail(new Error("DB crashed"))).toBe("DB crashed");
  });

  it("returns fallback for non-Error values", () => {
    expect(errDetail("string")).toBe("Unknown error");
    expect(errDetail(null)).toBe("Unknown error");
    expect(errDetail(undefined)).toBe("Unknown error");
    expect(errDetail(42)).toBe("Unknown error");
  });

  it("returns custom fallback when provided", () => {
    expect(errDetail("oops", "Custom fallback")).toBe("Custom fallback");
  });
});

// ─────────────────────────────────────────────
// safeError
// ─────────────────────────────────────────────
describe("safeError", () => {
  it("logs the error and returns an apiError response", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = safeError(new Error("DB down"), "OrderAPI");
    const body = await (res as any).json();

    expect(body.success).toBe(false);
    expect(body.error).toBe("Internal server error");
    expect(consoleSpy).toHaveBeenCalledWith("[OrderAPI]", "DB down");

    consoleSpy.mockRestore();
  });

  it("uses default status 500", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = safeError(new Error("err"), "Test");
    expect((res as any).status).toBe(500);
    vi.restoreAllMocks();
  });

  it("accepts custom fallback message and status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = safeError(new Error("err"), "Test", "Not allowed", 403);
    const body = await (res as any).json();
    expect(body.error).toBe("Not allowed");
    expect((res as any).status).toBe(403);
    vi.restoreAllMocks();
  });

  it("handles non-Error values in logging", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    safeError("string error", "Module");
    expect(consoleSpy).toHaveBeenCalledWith("[Module]", "string error");
    consoleSpy.mockRestore();
  });

  it("handles object errors in logging", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    safeError({ code: 500 }, "Module");
    expect(consoleSpy).toHaveBeenCalledWith("[Module]", { code: 500 });
    consoleSpy.mockRestore();
  });
});
