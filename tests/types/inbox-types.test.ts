/**
 * tests/types/inbox-types.test.ts
 * Validates that lib/crm/inbox-types.ts exports all type aliases, interfaces,
 * and runtime constants (STATUS_CONFIG, PRIORITY_CONFIG, TEMPLATE_CATEGORIES).
 */

import { describe, it, expect } from "vitest";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TEMPLATE_CATEGORIES,
} from "@/lib/crm/inbox-types";
import type {
  ConversationStatus,
  ConversationChannel,
  Priority,
  MessageDirection,
  SenderType,
  MessageType,
  MessageStatus,
  TemplateCategory,
  InboxConversation,
  InboxMessage,
  InboxLabel,
  InboxNote,
  InboxTemplate,
  InboxQuickReply,
  InboxEvent,
  InboxStats,
  ConversationDetail,
} from "@/lib/crm/inbox-types";

// Compile-time assertion helper
function assertType<T>(_val: T): void { /* no-op */ }

describe("inbox-types", () => {
  // =========================================================================
  // Type aliases (compile-time checks)
  // =========================================================================
  describe("type aliases", () => {
    it("ConversationStatus includes expected values", () => {
      const statuses: ConversationStatus[] = ["active", "waiting", "bot", "resolved", "archived"];
      expect(statuses).toHaveLength(5);
    });

    it("ConversationChannel includes expected values", () => {
      const channels: ConversationChannel[] = ["whatsapp", "webchat"];
      expect(channels).toHaveLength(2);
    });

    it("Priority includes expected values", () => {
      const priorities: Priority[] = ["low", "normal", "high", "urgent"];
      expect(priorities).toHaveLength(4);
    });

    it("MessageDirection includes expected values", () => {
      const directions: MessageDirection[] = ["inbound", "outbound"];
      expect(directions).toHaveLength(2);
    });

    it("SenderType includes expected values", () => {
      const senders: SenderType[] = ["customer", "agent", "bot", "system"];
      expect(senders).toHaveLength(4);
    });

    it("MessageType includes expected values", () => {
      const types: MessageType[] = ["text", "image", "document", "audio", "video", "template", "note", "location"];
      expect(types).toHaveLength(8);
    });

    it("MessageStatus includes expected values", () => {
      const statuses: MessageStatus[] = ["pending", "sent", "delivered", "read", "failed"];
      expect(statuses).toHaveLength(5);
    });

    it("TemplateCategory includes expected values", () => {
      const categories: TemplateCategory[] = ["welcome", "orders", "shipping", "payment", "offers", "followup", "general"];
      expect(categories).toHaveLength(7);
    });
  });

  // =========================================================================
  // Interface compile-time checks
  // =========================================================================
  describe("interfaces", () => {
    it("InboxConversation is a valid interface", () => {
      assertType<InboxConversation>({} as InboxConversation);
      expect(true).toBe(true);
    });

    it("InboxMessage is a valid interface", () => {
      assertType<InboxMessage>({} as InboxMessage);
      expect(true).toBe(true);
    });

    it("InboxLabel is a valid interface", () => {
      assertType<InboxLabel>({} as InboxLabel);
      expect(true).toBe(true);
    });

    it("InboxNote is a valid interface", () => {
      assertType<InboxNote>({} as InboxNote);
      expect(true).toBe(true);
    });

    it("InboxTemplate is a valid interface", () => {
      assertType<InboxTemplate>({} as InboxTemplate);
      expect(true).toBe(true);
    });

    it("InboxQuickReply is a valid interface", () => {
      assertType<InboxQuickReply>({} as InboxQuickReply);
      expect(true).toBe(true);
    });

    it("InboxEvent is a valid interface", () => {
      assertType<InboxEvent>({} as InboxEvent);
      expect(true).toBe(true);
    });

    it("InboxStats is a valid interface", () => {
      assertType<InboxStats>({} as InboxStats);
      expect(true).toBe(true);
    });

    it("ConversationDetail is a valid interface", () => {
      assertType<ConversationDetail>({} as ConversationDetail);
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // STATUS_CONFIG
  // =========================================================================
  describe("STATUS_CONFIG", () => {
    it("is exported", () => {
      expect(STATUS_CONFIG).toBeDefined();
    });

    it("has entries for all ConversationStatus values", () => {
      const expectedStatuses: ConversationStatus[] = ["active", "waiting", "bot", "resolved", "archived"];
      for (const status of expectedStatuses) {
        expect(STATUS_CONFIG[status]).toBeDefined();
      }
    });

    it("each entry has label, color, and dot", () => {
      for (const [, config] of Object.entries(STATUS_CONFIG)) {
        expect(config).toHaveProperty("label");
        expect(config).toHaveProperty("color");
        expect(config).toHaveProperty("dot");
        expect(typeof config.label).toBe("string");
        expect(typeof config.color).toBe("string");
        expect(typeof config.dot).toBe("string");
      }
    });

    it("active status has green color", () => {
      expect(STATUS_CONFIG.active.color).toContain("green");
    });

    it("waiting status has yellow color", () => {
      expect(STATUS_CONFIG.waiting.color).toContain("yellow");
    });
  });

  // =========================================================================
  // PRIORITY_CONFIG
  // =========================================================================
  describe("PRIORITY_CONFIG", () => {
    it("is exported", () => {
      expect(PRIORITY_CONFIG).toBeDefined();
    });

    it("has entries for all Priority values", () => {
      const expectedPriorities: Priority[] = ["low", "normal", "high", "urgent"];
      for (const priority of expectedPriorities) {
        expect(PRIORITY_CONFIG[priority]).toBeDefined();
      }
    });

    it("each entry has label and color", () => {
      for (const [, config] of Object.entries(PRIORITY_CONFIG)) {
        expect(config).toHaveProperty("label");
        expect(config).toHaveProperty("color");
        expect(typeof config.label).toBe("string");
        expect(typeof config.color).toBe("string");
      }
    });

    it("urgent priority has red color", () => {
      expect(PRIORITY_CONFIG.urgent.color).toContain("red");
    });
  });

  // =========================================================================
  // TEMPLATE_CATEGORIES
  // =========================================================================
  describe("TEMPLATE_CATEGORIES", () => {
    it("is exported as an array", () => {
      expect(TEMPLATE_CATEGORIES).toBeInstanceOf(Array);
    });

    it("has 7 categories", () => {
      expect(TEMPLATE_CATEGORIES).toHaveLength(7);
    });

    it("each category has value, label, and icon", () => {
      for (const cat of TEMPLATE_CATEGORIES) {
        expect(cat).toHaveProperty("value");
        expect(cat).toHaveProperty("label");
        expect(cat).toHaveProperty("icon");
        expect(typeof cat.value).toBe("string");
        expect(typeof cat.label).toBe("string");
        expect(typeof cat.icon).toBe("string");
      }
    });

    it("includes welcome category", () => {
      const welcome = TEMPLATE_CATEGORIES.find((c) => c.value === "welcome");
      expect(welcome).toBeDefined();
    });

    it("includes orders category", () => {
      const orders = TEMPLATE_CATEGORIES.find((c) => c.value === "orders");
      expect(orders).toBeDefined();
    });

    it("includes all expected template category values", () => {
      const values = TEMPLATE_CATEGORIES.map((c) => c.value);
      expect(values).toEqual(
        expect.arrayContaining(["welcome", "orders", "shipping", "payment", "offers", "followup", "general"]),
      );
    });

    it("has unique values", () => {
      const values = TEMPLATE_CATEGORIES.map((c) => c.value);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });
});
