import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  getSupabase: vi.fn(() => ({})),
}));

import { hasPermission, canAccessPage } from "@/lib/auth";

describe("Auth Utilities", () => {
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

    it("viewer has orders.read and customers.read", () => {
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

    it("content role has products, heroes, emails but not orders", () => {
      expect(hasPermission("content", "products")).toBe(true);
      expect(hasPermission("content", "heroes")).toBe(true);
      expect(hasPermission("content", "emails")).toBe(true);
      expect(hasPermission("content", "orders")).toBe(false);
    });
  });

  describe("canAccessPage", () => {
    it("super_admin can access any page", () => {
      expect(canAccessPage("super_admin", "orders")).toBe(true);
      expect(canAccessPage("super_admin", "settings")).toBe(true);
    });

    it("viewer can access orders.read", () => {
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
  });
});
