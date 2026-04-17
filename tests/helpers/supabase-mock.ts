/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ---------- chainable query builder ----------
type QueryResult = { data: any; error: any; count?: number };

export function createQueryBuilder(resolvedData: any = [], resolvedError: any = null) {
  const state: { result: QueryResult } = {
    result: { data: resolvedData, error: resolvedError },
  };

  const builder: Record<string, any> = {};

  const chainMethods = [
    "select", "insert", "update", "delete", "upsert",
    "eq", "neq", "gt", "lt", "gte", "lte", "in",
    "like", "ilike", "is", "not", "or", "and",
    "order", "limit", "range", "filter",
    "textSearch", "contains", "containedBy", "overlaps",
    "match", "csv",
  ];

  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }

  // terminal methods
  builder.single = vi.fn().mockResolvedValue({
    data: Array.isArray(state.result.data) ? state.result.data[0] ?? null : state.result.data,
    error: state.result.error,
  });

  builder.maybeSingle = vi.fn().mockResolvedValue({
    data: Array.isArray(state.result.data) ? state.result.data[0] ?? null : state.result.data,
    error: state.result.error,
  });

  builder.then = (resolve: any) =>
    resolve({ data: state.result.data, error: state.result.error });

  // allow awaiting the builder directly
  (builder as any)[Symbol.toStringTag] = "Promise";

  // helpers to change resolved data on the fly
  builder.__setData = (d: any) => { state.result.data = d; };
  builder.__setError = (e: any) => { state.result.error = e; };

  return builder;
}

// ---------- storage mock ----------
export function createStorageMock() {
  const bucket: Record<string, any> = {
    upload: vi.fn().mockResolvedValue({ data: { path: "test/file.jpg" }, error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob(["img"]), error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://storage.test/file.jpg" } }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.test/signed" }, error: null }),
  };

  return {
    from: vi.fn().mockReturnValue(bucket),
    listBuckets: vi.fn().mockResolvedValue({ data: [], error: null }),
    createBucket: vi.fn().mockResolvedValue({ data: null, error: null }),
    __bucket: bucket,
  };
}

// ---------- auth mock ----------
export function createAuthMock(user: any = null) {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user: user ?? { id: "auth-user-1", email: "admin@test.com" } },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: user
          ? { user, access_token: "mock-token", refresh_token: "mock-refresh" }
          : { user: { id: "auth-user-1", email: "admin@test.com" }, access_token: "mock-token", refresh_token: "mock-refresh" },
      },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: user ?? { id: "auth-user-1", email: "admin@test.com" }, session: {} },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: "new-user" } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
  };
}

// ---------- rpc mock ----------
export function createRpcMock(results: Record<string, any> = {}) {
  return vi.fn().mockImplementation((fn: string, params?: any) => {
    const val = results[fn];
    if (val instanceof Error) return Promise.resolve({ data: null, error: val });
    return Promise.resolve({ data: val ?? null, error: null });
  });
}

// ---------- full client mock ----------
export interface MockSupabaseClient {
  from: ((table: string) => any) & ReturnType<typeof vi.fn>;
  auth: ReturnType<typeof createAuthMock>;
  storage: ReturnType<typeof createStorageMock>;
  rpc: ReturnType<typeof createRpcMock>;
  channel: ((...args: any[]) => any) & ReturnType<typeof vi.fn>;
  removeChannel: ((...args: any[]) => any) & ReturnType<typeof vi.fn>;
  __queryBuilders: Map<string, ReturnType<typeof createQueryBuilder>>;
}

export function createMockSupabaseClient(
  tableData: Record<string, { data?: any; error?: any }> = {},
  rpcResults: Record<string, any> = {},
  authUser: any = null,
): MockSupabaseClient {
  const builders = new Map<string, ReturnType<typeof createQueryBuilder>>();

  for (const [table, { data, error }] of Object.entries(tableData)) {
    builders.set(table, createQueryBuilder(data ?? [], error ?? null));
  }

  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      builders.set(table, createQueryBuilder([], null));
    }
    return builders.get(table)!;
  });

  const channel = vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ status: "SUBSCRIBED" }),
    unsubscribe: vi.fn(),
  });

  return {
    from,
    auth: createAuthMock(authUser),
    storage: createStorageMock(),
    rpc: createRpcMock(rpcResults),
    channel,
    removeChannel: vi.fn(),
    __queryBuilders: builders,
  } as MockSupabaseClient;
}

// ---------- module-level mock installer ----------
// NOTE: do NOT call vi.mock inside a function body — vitest hoists vi.mock
// calls to the top of the module file regardless of nesting, which would
// register a mock whose factory closes over an undefined local variable.
// Prefer declaring `vi.mock("@/lib/supabase", …)` in the test file itself.
export function installSupabaseMock(
  tableData: Record<string, { data?: any; error?: any }> = {},
  rpcResults: Record<string, any> = {},
  authUser: any = null,
) {
  return createMockSupabaseClient(tableData, rpcResults, authUser);
}
