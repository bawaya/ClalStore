import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasPermission } from "@/lib/admin/auth";

// We test hasPermission as a pure function.
// requireAdmin, withAdminAuth, and withPermission rely heavily on Next.js
// request/response and Supabase SSR auth which we test through integration tests.

describe("hasPermission", () => {
  // ─── super_admin ────────────────────────────────────────────────

  describe("super_admin role", () => {
    it("has wildcard access to everything", () => {
      expect(hasPermission("super_admin", "products", "view")).toBe(true);
      expect(hasPermission("super_admin", "products", "create")).toBe(true);
      expect(hasPermission("super_admin", "products", "delete")).toBe(true);
      expect(hasPermission("super_admin", "users", "delete")).toBe(true);
      expect(hasPermission("super_admin", "settings", "edit")).toBe(true);
      expect(hasPermission("super_admin", "anything", "anything")).toBe(true);
    });
  });

  // ─── admin role ─────────────────────────────────────────────────

  describe("admin role", () => {
    it("can view and manage admin panel", () => {
      expect(hasPermission("admin", "admin", "view")).toBe(true);
      expect(hasPermission("admin", "admin", "manage")).toBe(true);
    });

    it("can perform all product operations", () => {
      expect(hasPermission("admin", "products", "view")).toBe(true);
      expect(hasPermission("admin", "products", "create")).toBe(true);
      expect(hasPermission("admin", "products", "edit")).toBe(true);
      expect(hasPermission("admin", "products", "delete")).toBe(true);
    });

    it("can perform all order operations", () => {
      expect(hasPermission("admin", "orders", "view")).toBe(true);
      expect(hasPermission("admin", "orders", "create")).toBe(true);
      expect(hasPermission("admin", "orders", "edit")).toBe(true);
      expect(hasPermission("admin", "orders", "export")).toBe(true);
    });

    it("can manage commissions", () => {
      expect(hasPermission("admin", "commissions", "view")).toBe(true);
      expect(hasPermission("admin", "commissions", "create")).toBe(true);
      expect(hasPermission("admin", "commissions", "edit")).toBe(true);
      expect(hasPermission("admin", "commissions", "delete")).toBe(true);
      expect(hasPermission("admin", "commissions", "manage")).toBe(true);
      expect(hasPermission("admin", "commissions", "export")).toBe(true);
    });

    it("can manage CRM", () => {
      expect(hasPermission("admin", "crm", "view")).toBe(true);
      expect(hasPermission("admin", "crm", "create")).toBe(true);
      expect(hasPermission("admin", "crm", "manage")).toBe(true);
    });

    it("can manage users", () => {
      expect(hasPermission("admin", "users", "view")).toBe(true);
      expect(hasPermission("admin", "users", "create")).toBe(true);
      expect(hasPermission("admin", "users", "delete")).toBe(true);
    });

    it("can edit settings", () => {
      expect(hasPermission("admin", "settings", "view")).toBe(true);
      expect(hasPermission("admin", "settings", "edit")).toBe(true);
    });
  });

  // ─── sales role ─────────────────────────────────────────────────

  describe("sales role", () => {
    it("can view admin panel", () => {
      expect(hasPermission("sales", "admin", "view")).toBe(true);
    });

    it("can view and create commissions", () => {
      expect(hasPermission("sales", "commissions", "view")).toBe(true);
      expect(hasPermission("sales", "commissions", "create")).toBe(true);
    });

    it("cannot delete commissions", () => {
      expect(hasPermission("sales", "commissions", "delete")).toBe(false);
    });

    it("cannot manage commissions", () => {
      expect(hasPermission("sales", "commissions", "manage")).toBe(false);
    });

    it("can view and create CRM entries", () => {
      expect(hasPermission("sales", "crm", "view")).toBe(true);
      expect(hasPermission("sales", "crm", "create")).toBe(true);
      expect(hasPermission("sales", "crm", "edit")).toBe(true);
    });

    it("cannot delete CRM entries", () => {
      expect(hasPermission("sales", "crm", "delete")).toBe(false);
    });

    it("can view products but not create or delete", () => {
      expect(hasPermission("sales", "products", "view")).toBe(true);
      expect(hasPermission("sales", "products", "create")).toBe(false);
      expect(hasPermission("sales", "products", "delete")).toBe(false);
    });

    it("cannot manage users", () => {
      expect(hasPermission("sales", "users", "view")).toBe(false);
      expect(hasPermission("sales", "users", "create")).toBe(false);
    });

    it("cannot edit settings", () => {
      expect(hasPermission("sales", "settings", "view")).toBe(false);
      expect(hasPermission("sales", "settings", "edit")).toBe(false);
    });
  });

  // ─── viewer role ────────────────────────────────────────────────

  describe("viewer role", () => {
    it("can view admin panel", () => {
      expect(hasPermission("viewer", "admin", "view")).toBe(true);
    });

    it("can view products, orders, CRM, commissions", () => {
      expect(hasPermission("viewer", "products", "view")).toBe(true);
      expect(hasPermission("viewer", "orders", "view")).toBe(true);
      expect(hasPermission("viewer", "crm", "view")).toBe(true);
      expect(hasPermission("viewer", "commissions", "view")).toBe(true);
    });

    it("cannot create, edit, or delete anything", () => {
      expect(hasPermission("viewer", "products", "create")).toBe(false);
      expect(hasPermission("viewer", "products", "edit")).toBe(false);
      expect(hasPermission("viewer", "products", "delete")).toBe(false);
      expect(hasPermission("viewer", "orders", "create")).toBe(false);
      expect(hasPermission("viewer", "orders", "edit")).toBe(false);
    });

    it("can view reports and settings", () => {
      expect(hasPermission("viewer", "reports", "view")).toBe(true);
      expect(hasPermission("viewer", "settings", "view")).toBe(true);
    });

    it("cannot edit settings", () => {
      expect(hasPermission("viewer", "settings", "edit")).toBe(false);
    });
  });

  // ─── unknown role ───────────────────────────────────────────────

  describe("unknown role", () => {
    it("has no permissions", () => {
      expect(hasPermission("customer", "products", "view")).toBe(false);
      expect(hasPermission("guest", "admin", "view")).toBe(false);
      expect(hasPermission("", "products", "view")).toBe(false);
    });
  });

  // ─── edge cases ─────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles non-existent module", () => {
      expect(hasPermission("admin", "nonexistent", "view")).toBe(false);
    });

    it("handles non-existent action", () => {
      expect(hasPermission("admin", "products", "nonexistent")).toBe(false);
    });

    it("super_admin passes even for non-existent module/action", () => {
      expect(hasPermission("super_admin", "nonexistent", "anything")).toBe(true);
    });
  });
});
