import { vi } from "vitest";

export function createSupabaseChain(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      resolve({ data, error }),
  };

  for (const key of Object.keys(obj)) {
    if (
      typeof obj[key] === "function" &&
      key !== "single" &&
      key !== "maybeSingle" &&
      key !== "then"
    ) {
      (obj[key] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }

  return obj;
}
