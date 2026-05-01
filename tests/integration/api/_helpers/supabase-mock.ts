import { vi } from "vitest";

export function createSupabaseChain(data: unknown = null, error: unknown = null) {
  const resultPromise = Promise.resolve({ data, error });

  return Object.assign(resultPromise, {
    select: vi.fn(() => resultPromise),
    insert: vi.fn(() => resultPromise),
    update: vi.fn(() => resultPromise),
    eq: vi.fn(() => resultPromise),
    neq: vi.fn(() => resultPromise),
    single: vi.fn(() => resultPromise),
    maybeSingle: vi.fn(() => resultPromise),
  });
}
