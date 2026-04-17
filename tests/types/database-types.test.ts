/**
 * tests/types/database-types.test.ts
 * Verifies that all database types can be instantiated via factory helpers
 * and that factory outputs match the expected type shapes.
 */

import { describe, it, expect } from "vitest";
import {
  makeProduct, makeOrder, makeOrderItem, makeOrderNote, makeOrderStatusHistory,
  makeCustomer, makeCustomerNote, makeCustomerHotAccount, makeCustomerOTP,
  makeUser, makeCategory, makeCoupon, makeDeal, makeHero, makeLinePlan,
  makeSetting, makeWebsiteContent, makeSubPage, makeIntegration, makeEmailTemplate,
  makeInboxConversation, makeInboxMessage, makeInboxLabel, makeInboxNote,
  makeInboxTemplate, makeInboxQuickReply,
  makeBotConversation, makeBotMessage, makeBotTemplate, makeBotPolicy,
  makeBotAnalytics, makeBotHandoff,
  makeCommissionSale, makeCommissionEmployee, makeCommissionSanction,
  makeCommissionTarget, makeCommissionSyncLog, makeEmployeeCommissionProfile,
  makePipelineDeal, makePipelineStage, makeTask,
  makeNotification, makePushSubscription, makePushNotification,
  makeLoyaltyPoints, makeLoyaltyTransaction,
  makeProductReview, makeAbandonedCart, makeAuditEntry,
  makeSalesDoc, makeSalesDocItem, makeSalesDocAttachment,
  makeSalesDocEvent, makeSalesDocSyncQueue,
} from "@/tests/helpers/factories";

describe("database type factories", () => {
  // =========================================================================
  // Core Commerce
  // =========================================================================
  describe("Product", () => {
    it("creates a valid Product with defaults", () => {
      const p = makeProduct();
      expect(p.id).toBeDefined();
      expect(p.type).toBe("device");
      expect(p.brand).toBe("Apple");
      expect(p.name_ar).toBeDefined();
      expect(p.name_he).toBeDefined();
      expect(typeof p.price).toBe("number");
      expect(typeof p.cost).toBe("number");
      expect(typeof p.stock).toBe("number");
      expect(p.gallery).toBeInstanceOf(Array);
      expect(p.colors).toBeInstanceOf(Array);
      expect(p.storage_options).toBeInstanceOf(Array);
      expect(p.variants).toBeInstanceOf(Array);
      expect(typeof p.specs).toBe("object");
      expect(typeof p.active).toBe("boolean");
    });

    it("accepts overrides", () => {
      const p = makeProduct({ brand: "Samsung", price: 2999 });
      expect(p.brand).toBe("Samsung");
      expect(p.price).toBe(2999);
    });
  });

  describe("Order", () => {
    it("creates a valid Order with defaults", () => {
      const o = makeOrder();
      expect(o.id).toMatch(/^CLM-/);
      expect(o.customer_id).toBeDefined();
      expect(o.status).toBe("new");
      expect(o.source).toBe("store");
      expect(typeof o.total).toBe("number");
      expect(o.payment_method).toBe("credit");
      expect(typeof o.payment_details).toBe("object");
    });

    it("accepts overrides", () => {
      const o = makeOrder({ status: "approved", total: 5000 });
      expect(o.status).toBe("approved");
      expect(o.total).toBe(5000);
    });
  });

  describe("OrderItem", () => {
    it("creates a valid OrderItem", () => {
      const oi = makeOrderItem();
      expect(oi.id).toBeDefined();
      expect(oi.order_id).toBeDefined();
      expect(oi.product_id).toBeDefined();
      expect(typeof oi.price).toBe("number");
      expect(typeof oi.quantity).toBe("number");
    });
  });

  describe("OrderNote", () => {
    it("creates a valid OrderNote", () => {
      const n = makeOrderNote();
      expect(n.id).toBeDefined();
      expect(n.text).toBeDefined();
      expect(n.user_name).toBeDefined();
    });
  });

  describe("OrderStatusHistory", () => {
    it("creates a valid OrderStatusHistory", () => {
      const h = makeOrderStatusHistory();
      expect(h.old_status).toBe("new");
      expect(h.new_status).toBe("approved");
    });
  });

  // =========================================================================
  // Customers
  // =========================================================================
  describe("Customer", () => {
    it("creates a valid Customer", () => {
      const c = makeCustomer();
      expect(c.name).toBeDefined();
      expect(c.phone).toBeDefined();
      expect(typeof c.total_orders).toBe("number");
      expect(typeof c.total_spent).toBe("number");
      expect(c.tags).toBeInstanceOf(Array);
      expect(c.segment).toBeDefined();
    });

    it("accepts overrides", () => {
      const c = makeCustomer({ name: "Test", segment: "vip" });
      expect(c.name).toBe("Test");
      expect(c.segment).toBe("vip");
    });
  });

  describe("CustomerNote", () => {
    it("creates a valid CustomerNote", () => {
      const n = makeCustomerNote();
      expect(n.customer_id).toBeDefined();
      expect(n.text).toBeDefined();
    });
  });

  describe("CustomerHotAccount", () => {
    it("creates a valid CustomerHotAccount", () => {
      const h = makeCustomerHotAccount();
      expect(h.customer_id).toBeDefined();
      expect(h.status).toBe("active");
      expect(typeof h.is_primary).toBe("boolean");
    });
  });

  describe("CustomerOTP", () => {
    it("creates a valid CustomerOTP", () => {
      const otp = makeCustomerOTP();
      expect(otp.phone).toBeDefined();
      expect(otp.otp).toBeDefined();
      expect(typeof otp.verified).toBe("boolean");
    });
  });

  // =========================================================================
  // Users & Auth
  // =========================================================================
  describe("AppUser", () => {
    it("creates a valid AppUser", () => {
      const u = makeUser();
      expect(u.auth_id).toBeDefined();
      expect(u.name).toBeDefined();
      expect(u.email).toBeDefined();
      expect(u.role).toBe("super_admin");
      expect(u.status).toBe("active");
    });
  });

  // =========================================================================
  // Catalog
  // =========================================================================
  describe("Category", () => {
    it("creates a valid Category", () => {
      const c = makeCategory();
      expect(c.name_ar).toBeDefined();
      expect(c.name_he).toBeDefined();
      expect(c.type).toBe("manual");
    });
  });

  describe("Coupon", () => {
    it("creates a valid Coupon", () => {
      const c = makeCoupon();
      expect(c.code).toBe("SAVE10");
      expect(c.type).toBe("percent");
      expect(typeof c.value).toBe("number");
    });
  });

  describe("Deal", () => {
    it("creates a valid Deal", () => {
      const d = makeDeal();
      expect(d.title_ar).toBeDefined();
      expect(d.deal_type).toBe("discount");
      expect(typeof d.discount_percent).toBe("number");
    });
  });

  describe("Hero", () => {
    it("creates a valid Hero", () => {
      const h = makeHero();
      expect(h.title_ar).toBeDefined();
      expect(h.title_he).toBeDefined();
      expect(typeof h.active).toBe("boolean");
    });
  });

  describe("LinePlan", () => {
    it("creates a valid LinePlan", () => {
      const l = makeLinePlan();
      expect(l.data_amount).toBe("10GB");
      expect(typeof l.price).toBe("number");
      expect(l.features_ar).toBeInstanceOf(Array);
    });
  });

  // =========================================================================
  // Settings & Content
  // =========================================================================
  describe("Setting", () => {
    it("creates a valid Setting", () => {
      const s = makeSetting();
      expect(s.key).toBeDefined();
      expect(s.value).toBeDefined();
      expect(s.type).toBe("string");
    });
  });

  describe("WebsiteContent", () => {
    it("creates a valid WebsiteContent", () => {
      const w = makeWebsiteContent();
      expect(w.section).toBeDefined();
      expect(typeof w.is_visible).toBe("boolean");
    });
  });

  describe("SubPage", () => {
    it("creates a valid SubPage", () => {
      const s = makeSubPage();
      expect(s.slug).toBeDefined();
      expect(s.title_ar).toBeDefined();
    });
  });

  describe("Integration", () => {
    it("creates a valid Integration", () => {
      const i = makeIntegration();
      expect(i.type).toBe("whatsapp");
      expect(i.status).toBe("active");
    });
  });

  describe("EmailTemplate", () => {
    it("creates a valid EmailTemplate", () => {
      const e = makeEmailTemplate();
      expect(e.slug).toBe("order_confirmed");
      expect(e.variables).toBeInstanceOf(Array);
    });
  });

  // =========================================================================
  // Inbox
  // =========================================================================
  describe("InboxConversation", () => {
    it("creates a valid InboxConversation", () => {
      const c = makeInboxConversation();
      expect(c.channel).toBe("whatsapp");
      expect(c.status).toBe("active");
      expect(typeof c.unread_count).toBe("number");
    });
  });

  describe("InboxMessage", () => {
    it("creates a valid InboxMessage", () => {
      const m = makeInboxMessage();
      expect(m.direction).toBe("inbound");
      expect(m.sender_type).toBe("customer");
      expect(m.message_type).toBe("text");
    });
  });

  describe("InboxLabel", () => {
    it("creates a valid InboxLabel", () => {
      const l = makeInboxLabel();
      expect(l.name).toBe("VIP");
      expect(l.color).toBeDefined();
    });
  });

  describe("InboxNote", () => {
    it("creates a valid InboxNote", () => {
      const n = makeInboxNote();
      expect(n.content).toBeDefined();
    });
  });

  describe("InboxTemplate", () => {
    it("creates a valid InboxTemplate", () => {
      const t = makeInboxTemplate();
      expect(t.name).toBe("Welcome");
      expect(t.variables).toBeInstanceOf(Array);
    });
  });

  describe("InboxQuickReply", () => {
    it("creates a valid InboxQuickReply", () => {
      const q = makeInboxQuickReply();
      expect(q.shortcut).toBe("/hi");
      expect(typeof q.is_active).toBe("boolean");
    });
  });

  // =========================================================================
  // Bot
  // =========================================================================
  describe("BotConversation", () => {
    it("creates a valid BotConversation", () => {
      const b = makeBotConversation();
      expect(b.channel).toBe("webchat");
      expect(b.language).toBe("ar");
    });
  });

  describe("BotMessage", () => {
    it("creates a valid BotMessage", () => {
      const m = makeBotMessage();
      expect(m.role).toBe("user");
      expect(m.content).toBeDefined();
    });
  });

  describe("BotTemplate", () => {
    it("creates a valid BotTemplate", () => {
      const t = makeBotTemplate();
      expect(t.key).toBe("welcome");
      expect(t.channel).toBe("all");
    });
  });

  describe("BotPolicy", () => {
    it("creates a valid BotPolicy", () => {
      const p = makeBotPolicy();
      expect(p.type).toBe("warranty");
      expect(p.content_ar).toBeDefined();
    });
  });

  describe("BotAnalytics", () => {
    it("creates a valid BotAnalytics", () => {
      const a = makeBotAnalytics();
      expect(typeof a.total_conversations).toBe("number");
      expect(typeof a.total_messages).toBe("number");
    });
  });

  describe("BotHandoff", () => {
    it("creates a valid BotHandoff", () => {
      const h = makeBotHandoff();
      expect(h.reason).toBe("human_request");
      expect(h.status).toBe("pending");
    });
  });

  // =========================================================================
  // Commissions
  // =========================================================================
  describe("CommissionSale", () => {
    it("creates a valid CommissionSale", () => {
      const s = makeCommissionSale();
      expect(typeof s.id).toBe("number");
      expect(s.sale_type).toBe("line");
      expect(typeof s.package_price).toBe("number");
      expect(typeof s.commission_amount).toBe("number");
    });
  });

  describe("CommissionEmployee", () => {
    it("creates a valid CommissionEmployee", () => {
      const e = makeCommissionEmployee();
      expect(e.name).toBeDefined();
      expect(e.token).toBeDefined();
      expect(typeof e.active).toBe("boolean");
    });
  });

  describe("CommissionSanction", () => {
    it("creates a valid CommissionSanction", () => {
      const s = makeCommissionSanction();
      expect(s.sanction_type).toBe("deduction");
      expect(typeof s.amount).toBe("number");
    });
  });

  describe("CommissionTarget", () => {
    it("creates a valid CommissionTarget", () => {
      const t = makeCommissionTarget();
      expect(t.month).toBeDefined();
      expect(typeof t.target_total).toBe("number");
    });
  });

  describe("CommissionSyncLog", () => {
    it("creates a valid CommissionSyncLog", () => {
      const l = makeCommissionSyncLog();
      expect(typeof l.orders_synced).toBe("number");
      expect(l.status).toBe("success");
    });
  });

  describe("EmployeeCommissionProfile", () => {
    it("creates a valid EmployeeCommissionProfile", () => {
      const p = makeEmployeeCommissionProfile();
      expect(p.user_id).toBeDefined();
      expect(typeof p.line_multiplier).toBe("number");
      expect(typeof p.loyalty_bonuses).toBe("object");
    });
  });

  // =========================================================================
  // Pipeline
  // =========================================================================
  describe("PipelineDeal", () => {
    it("creates a valid PipelineDeal", () => {
      const d = makePipelineDeal();
      expect(d.customer_name).toBeDefined();
      expect(typeof d.value).toBe("number");
      expect(d.stage).toBe("lead");
    });
  });

  describe("PipelineStage", () => {
    it("creates a valid PipelineStage", () => {
      const s = makePipelineStage();
      expect(s.name).toBe("Lead");
      expect(typeof s.sort_order).toBe("number");
    });
  });

  describe("Task", () => {
    it("creates a valid Task", () => {
      const t = makeTask();
      expect(t.title).toBeDefined();
      expect(t.priority).toBe("medium");
      expect(t.status).toBe("pending");
    });
  });

  // =========================================================================
  // Notifications & Push
  // =========================================================================
  describe("Notification", () => {
    it("creates a valid Notification", () => {
      const n = makeNotification();
      expect(n.type).toBe("order");
      expect(n.title).toBeDefined();
      expect(typeof n.read).toBe("boolean");
    });
  });

  describe("PushSubscription", () => {
    it("creates a valid PushSubscription", () => {
      const p = makePushSubscription();
      expect(p.endpoint).toBeDefined();
      expect(typeof p.keys).toBe("object");
      expect(typeof p.active).toBe("boolean");
    });
  });

  describe("PushNotification", () => {
    it("creates a valid PushNotification", () => {
      const p = makePushNotification();
      expect(p.title).toBeDefined();
      expect(p.target).toBe("all");
    });
  });

  // =========================================================================
  // Loyalty
  // =========================================================================
  describe("LoyaltyPoints", () => {
    it("creates a valid LoyaltyPoints", () => {
      const l = makeLoyaltyPoints();
      expect(typeof l.points).toBe("number");
      expect(l.tier).toBe("silver");
    });
  });

  describe("LoyaltyTransaction", () => {
    it("creates a valid LoyaltyTransaction", () => {
      const t = makeLoyaltyTransaction();
      expect(t.type).toBe("earn");
      expect(typeof t.points).toBe("number");
    });
  });

  // =========================================================================
  // Reviews & Carts
  // =========================================================================
  describe("ProductReview", () => {
    it("creates a valid ProductReview", () => {
      const r = makeProductReview();
      expect(typeof r.rating).toBe("number");
      expect(r.status).toBe("approved");
    });
  });

  describe("AbandonedCart", () => {
    it("creates a valid AbandonedCart", () => {
      const c = makeAbandonedCart();
      expect(c.items).toBeInstanceOf(Array);
      expect(typeof c.total).toBe("number");
    });
  });

  // =========================================================================
  // Audit
  // =========================================================================
  describe("AuditEntry", () => {
    it("creates a valid AuditEntry", () => {
      const a = makeAuditEntry();
      expect(a.action).toBe("create");
      expect(a.entity_type).toBe("product");
    });
  });

  // =========================================================================
  // Sales Docs
  // =========================================================================
  describe("SalesDoc", () => {
    it("creates a valid SalesDoc", () => {
      const d = makeSalesDoc();
      expect(typeof d.id).toBe("number");
      expect(d.status).toBe("draft");
      expect(d.sale_type).toBe("device");
    });
  });

  describe("SalesDocItem", () => {
    it("creates a valid SalesDocItem", () => {
      const i = makeSalesDocItem();
      expect(i.item_type).toBe("device");
      expect(typeof i.qty).toBe("number");
    });
  });

  describe("SalesDocAttachment", () => {
    it("creates a valid SalesDocAttachment", () => {
      const a = makeSalesDocAttachment();
      expect(a.file_name).toBeDefined();
      expect(a.mime_type).toBeDefined();
    });
  });

  describe("SalesDocEvent", () => {
    it("creates a valid SalesDocEvent", () => {
      const e = makeSalesDocEvent();
      expect(e.event_type).toBe("created");
    });
  });

  describe("SalesDocSyncQueue", () => {
    it("creates a valid SalesDocSyncQueue", () => {
      const q = makeSalesDocSyncQueue();
      expect(q.status).toBe("pending");
      expect(typeof q.attempts).toBe("number");
    });
  });
});
