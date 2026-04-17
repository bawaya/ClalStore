import { describe, it, expect } from "vitest";
import {
  ORDER_STATUS,
  USER_ROLE,
  ROLE_PERMISSIONS,
  type UserRole,
  type OrderStatus,
} from "@/lib/constants";

describe("Constants", () => {
  describe("ORDER_STATUS", () => {
    const expectedKeys: OrderStatus[] = [
      "new",
      "approved",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "rejected",
      "returned",
      "no_reply_1",
      "no_reply_2",
      "no_reply_3",
    ];

    it("has all expected status keys", () => {
      for (const key of expectedKeys) {
        expect(ORDER_STATUS).toHaveProperty(key);
      }
    });

    it("has no extra unexpected keys", () => {
      expect(Object.keys(ORDER_STATUS).sort()).toEqual(expectedKeys.sort());
    });

    it("each status has label, labelHe, color, and icon", () => {
      for (const key of expectedKeys) {
        const status = ORDER_STATUS[key];
        expect(status.label).toBeDefined();
        expect(status.labelHe).toBeDefined();
        expect(status.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(status.icon).toBeDefined();
      }
    });
  });

  describe("USER_ROLE", () => {
    const expectedRoles: UserRole[] = [
      "super_admin",
      "admin",
      "sales",
      "support",
      "content",
      "viewer",
    ];

    it("has all expected roles", () => {
      for (const role of expectedRoles) {
        expect(USER_ROLE).toHaveProperty(role);
      }
    });

    it("each role has label, labelHe, color, icon, and permissions", () => {
      for (const role of expectedRoles) {
        const meta = USER_ROLE[role];
        expect(meta.label).toBeDefined();
        expect(meta.labelHe).toBeDefined();
        expect(meta.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(meta.icon).toBeDefined();
        expect(Array.isArray(meta.permissions)).toBe(true);
      }
    });
  });

  describe("ROLE_PERMISSIONS", () => {
    it("super_admin has wildcard permission", () => {
      expect(ROLE_PERMISSIONS.super_admin).toEqual(["*"]);
    });

    it("viewer has read-only permissions", () => {
      for (const perm of ROLE_PERMISSIONS.viewer) {
        expect(perm).toMatch(/\.read$/);
      }
    });

    it("all USER_ROLE keys exist in ROLE_PERMISSIONS", () => {
      for (const role of Object.keys(USER_ROLE)) {
        expect(ROLE_PERMISSIONS).toHaveProperty(role);
      }
    });

    it("all ROLE_PERMISSIONS keys exist in USER_ROLE", () => {
      for (const role of Object.keys(ROLE_PERMISSIONS)) {
        expect(USER_ROLE).toHaveProperty(role);
      }
    });

    it("admin has broad permissions but not wildcard", () => {
      expect(ROLE_PERMISSIONS.admin).not.toContain("*");
      expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(5);
    });

    it("sales permissions are a subset of admin", () => {
      for (const perm of ROLE_PERMISSIONS.sales) {
        expect(ROLE_PERMISSIONS.admin).toContain(perm);
      }
    });
  });
});
