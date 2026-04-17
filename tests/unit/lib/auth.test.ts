import { describe, it, expect, vi } from "vitest";

// Use vi.hoisted to define mock data before vi.mock hoists
const { mockClient } = vi.hoisted(() => {
  const authMock = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "admin@test.com" } },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "admin@test.com" }, session: {} },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };

  // Chainable query builder for the "users" table
  const usersBuilder: Record<string, any> = {};
  const chainMethods = ["select", "eq", "neq", "order", "limit", "filter"];
  for (const m of chainMethods) {
    usersBuilder[m] = vi.fn().mockReturnValue(usersBuilder);
  }
  usersBuilder.single = vi.fn().mockResolvedValue({
    data: { id: "user-1", name: "Admin", role: "super_admin", avatar_url: null },
    error: null,
  });

  const client = {
    auth: authMock,
    from: vi.fn().mockReturnValue(usersBuilder),
    __usersBuilder: usersBuilder,
  };

  return { mockClient: client };
});

vi.mock("@/lib/supabase", () => ({
  getSupabase: vi.fn(() => mockClient),
}));

import { hasPermission, canAccessPage, getCurrentUser, signIn, signOut } from "@/lib/auth";

// ─────────────────────────────────────────────
// hasPermission
// ─────────────────────────────────────────────
describe("hasPermission", () => {
  it("super_admin has access to everything", () => {
    expect(hasPermission("super_admin", "orders")).toBe(true);
    expect(hasPermission("super_admin", "settings")).toBe(true);
    expect(hasPermission("super_admin", "products")).toBe(true);
    expect(hasPermission("super_admin", "anything.at.all")).toBe(true);
  });

  it("admin has access to assigned sections", () => {
    expect(hasPermission("admin", "products")).toBe(true);
    expect(hasPermission("admin", "orders")).toBe(true);
    expect(hasPermission("admin", "customers")).toBe(true);
    expect(hasPermission("admin", "settings")).toBe(true);
  });

  it("admin does not have access to unassigned sections", () => {
    expect(hasPermission("admin", "commissions")).toBe(false);
  });

  it("sales has access to orders, customers, tasks, pipeline", () => {
    expect(hasPermission("sales", "orders")).toBe(true);
    expect(hasPermission("sales", "customers")).toBe(true);
    expect(hasPermission("sales", "tasks")).toBe(true);
    expect(hasPermission("sales", "pipeline")).toBe(true);
  });

  it("sales does not have access to products or settings", () => {
    expect(hasPermission("sales", "products")).toBe(false);
    expect(hasPermission("sales", "settings")).toBe(false);
  });

  it("support has access to orders, customers, tasks only", () => {
    expect(hasPermission("support", "orders")).toBe(true);
    expect(hasPermission("support", "customers")).toBe(true);
    expect(hasPermission("support", "tasks")).toBe(true);
    expect(hasPermission("support", "pipeline")).toBe(false);
    expect(hasPermission("support", "products")).toBe(false);
  });

  it("content has access to products, heroes, emails only", () => {
    expect(hasPermission("content", "products")).toBe(true);
    expect(hasPermission("content", "heroes")).toBe(true);
    expect(hasPermission("content", "emails")).toBe(true);
    expect(hasPermission("content", "orders")).toBe(false);
    expect(hasPermission("content", "settings")).toBe(false);
  });

  it("viewer has orders.read and customers.read only", () => {
    expect(hasPermission("viewer", "orders.read")).toBe(true);
    expect(hasPermission("viewer", "customers.read")).toBe(true);
  });

  it("viewer does not have write permissions", () => {
    expect(hasPermission("viewer", "orders")).toBe(false);
    expect(hasPermission("viewer", "orders.write")).toBe(false);
    expect(hasPermission("viewer", "products")).toBe(false);
  });

  it("section permission grants access to sub-permissions", () => {
    expect(hasPermission("admin", "orders.read")).toBe(true);
    expect(hasPermission("admin", "orders.write")).toBe(true);
    expect(hasPermission("admin", "products.edit")).toBe(true);
  });

  it("returns false for an unknown role", () => {
    expect(hasPermission("nonexistent" as any, "orders")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// canAccessPage
// ─────────────────────────────────────────────
describe("canAccessPage", () => {
  it("super_admin can access any page", () => {
    expect(canAccessPage("super_admin", "orders")).toBe(true);
    expect(canAccessPage("super_admin", "settings")).toBe(true);
    expect(canAccessPage("super_admin", "anything")).toBe(true);
  });

  it("viewer can access orders.read page", () => {
    expect(canAccessPage("viewer", "orders.read")).toBe(true);
  });

  it("viewer cannot access products page", () => {
    expect(canAccessPage("viewer", "products")).toBe(false);
  });

  it("support can access orders, customers, tasks", () => {
    expect(canAccessPage("support", "orders")).toBe(true);
    expect(canAccessPage("support", "customers")).toBe(true);
    expect(canAccessPage("support", "tasks")).toBe(true);
  });

  it("support cannot access pipeline or products", () => {
    expect(canAccessPage("support", "pipeline")).toBe(false);
    expect(canAccessPage("support", "products")).toBe(false);
  });

  it("canAccessPage delegates to hasPermission", () => {
    expect(canAccessPage("sales", "orders")).toBe(hasPermission("sales", "orders"));
    expect(canAccessPage("sales", "products")).toBe(hasPermission("sales", "products"));
  });
});

// ─────────────────────────────────────────────
// getCurrentUser (with mocked Supabase)
// ─────────────────────────────────────────────
describe("getCurrentUser", () => {
  it("returns the user profile when authenticated", async () => {
    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user!.id).toBe("user-1");
    expect(user!.email).toBe("admin@test.com");
    expect(user!.name).toBe("Admin");
    expect(user!.role).toBe("super_admin");
  });

  it("returns null when auth user is not found", async () => {
    mockClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("returns null when profile is not found in database", async () => {
    mockClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-1", email: "admin@test.com" } },
      error: null,
    });
    mockClient.__usersBuilder.single.mockResolvedValueOnce({ data: null, error: null });

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

// ─────────────────────────────────────────────
// signIn (with mocked Supabase)
// ─────────────────────────────────────────────
describe("signIn", () => {
  it("calls signInWithPassword and returns data on success", async () => {
    const result = await signIn("admin@test.com", "password123");
    expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@test.com",
      password: "password123",
    });
    expect(result).toBeDefined();
  });

  it("throws when signInWithPassword returns an error", async () => {
    const error = new Error("Invalid credentials");
    mockClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error,
    });
    await expect(signIn("bad@test.com", "wrong")).rejects.toThrow("Invalid credentials");
  });
});

// ─────────────────────────────────────────────
// signOut (with mocked Supabase)
// ─────────────────────────────────────────────
describe("signOut", () => {
  it("calls supabase.auth.signOut", async () => {
    await signOut();
    expect(mockClient.auth.signOut).toHaveBeenCalled();
  });
});
