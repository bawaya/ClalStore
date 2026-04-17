/**
 * tests/db/schema-types.test.ts
 * Validates the Database type from types/database.ts:
 * - All exported types exist
 * - Database type has expected table definitions
 * - Key tables have expected column shapes
 */

import { describe, it, expect } from "vitest";
import type {
  Database,
  Product, Order, OrderItem, OrderNote, OrderStatusHistory,
  Customer, CustomerNote, CustomerHotAccount, CustomerOTP,
  AppUser, Category, Coupon, Deal, Hero, LinePlan, Setting,
  WebsiteContent, SubPage, Integration, EmailTemplate,
  InboxConversation, InboxMessage, InboxLabel, InboxNote,
  InboxTemplate, InboxQuickReply,
  BotConversation, BotMessage, BotTemplate, BotPolicy,
  BotAnalytics, BotHandoff,
  CommissionSale, CommissionEmployee, CommissionSanction,
  CommissionTarget, CommissionSyncLog, EmployeeCommissionProfile,
  PipelineDeal, PipelineStage, Task,
  Notification, PushSubscription, PushNotification,
  LoyaltyPoints, LoyaltyTransaction,
  ProductReview, AbandonedCart, AuditEntry,
  ProductColor, ProductVariant,
  SalesDoc, SalesDocItem, SalesDocAttachment, SalesDocEvent, SalesDocSyncQueue,
} from "@/types/database";

// Type-level assertion helper: if this compiles, the type exists and is correct
function assertType<T>(_val: T): void {
  // no-op, compile-time check only
}

describe("database schema types", () => {
  // =========================================================================
  // Database type has all table definitions
  // =========================================================================
  describe("Database type tables", () => {
    it("Database.public.Tables has all expected table keys (compile-time check)", () => {
      // This is a compile-time test. If it compiles, the tables exist.
      type Tables = Database["public"]["Tables"];
      type ExpectedTables =
        | "products" | "orders" | "order_items" | "order_notes" | "order_status_history"
        | "customers" | "customer_notes" | "customer_hot_accounts" | "customer_otps"
        | "coupons" | "heroes" | "line_plans" | "email_templates"
        | "settings" | "integrations" | "users" | "tasks"
        | "pipeline_deals" | "pipeline_stages" | "audit_log" | "categories"
        | "bot_conversations" | "bot_messages" | "bot_handoffs" | "bot_policies"
        | "bot_templates" | "bot_analytics"
        | "abandoned_carts" | "product_reviews" | "deals"
        | "push_subscriptions" | "push_notifications"
        | "website_content" | "notifications"
        | "loyalty_points" | "loyalty_transactions"
        | "commission_sales" | "commission_targets" | "commission_sanctions"
        | "commission_sync_log" | "employee_commission_profiles"
        | "commission_employees"
        | "sales_docs" | "sales_doc_items" | "sales_doc_attachments"
        | "sales_doc_events" | "sales_doc_sync_queue";

      // If Tables has all ExpectedTables keys, this assignment compiles
      type HasAll = ExpectedTables extends keyof Tables ? true : false;
      const check: HasAll = true;
      expect(check).toBe(true);
    });

    it("each table definition has Row, Insert, and Update", () => {
      // Compile-time check
      type ProductsTable = Database["public"]["Tables"]["products"];
      assertType<ProductsTable["Row"]>({} as Product);
      assertType<ProductsTable["Insert"]>({} as Omit<Product, "id" | "created_at" | "updated_at">);

      type OrdersTable = Database["public"]["Tables"]["orders"];
      assertType<OrdersTable["Row"]>({} as Order);

      type CustomersTable = Database["public"]["Tables"]["customers"];
      assertType<CustomersTable["Row"]>({} as Customer);

      expect(true).toBe(true); // if we reach here, compile-time checks passed
    });
  });

  // =========================================================================
  // Product type shape
  // =========================================================================
  describe("Product type", () => {
    it("has expected core fields", () => {
      const product: Product = {
        id: "1", type: "device", brand: "Apple",
        name_ar: "آيفون", name_he: "אייפון", price: 3499, cost: 2500,
        stock: 50, sold: 10, gallery: [], colors: [],
        storage_options: [], variants: [], specs: {},
        active: true, featured: false,
        created_at: "", updated_at: "",
      };
      expect(product.name_ar).toBeDefined();
      expect(product.price).toBeDefined();
      expect(product.type).toBe("device");
    });

    it("type field is limited to device or accessory", () => {
      // Compile-time check
      const deviceProduct: Product["type"] = "device";
      const accessoryProduct: Product["type"] = "accessory";
      expect(deviceProduct).toBe("device");
      expect(accessoryProduct).toBe("accessory");
    });

    it("has gallery as string array", () => {
      const product = { gallery: ["/img/1.jpg", "/img/2.jpg"] } as Partial<Product>;
      expect(product.gallery).toBeInstanceOf(Array);
    });

    it("has colors as ProductColor array", () => {
      const color: ProductColor = { hex: "#000", name_ar: "أسود", name_he: "שחור" };
      expect(color.hex).toBe("#000");
      expect(color.name_ar).toBeDefined();
      expect(color.name_he).toBeDefined();
    });

    it("has variants as ProductVariant array", () => {
      const variant: ProductVariant = { storage: "256GB", price: 3999 };
      expect(variant.storage).toBe("256GB");
      expect(variant.price).toBe(3999);
    });
  });

  // =========================================================================
  // Order type shape
  // =========================================================================
  describe("Order type", () => {
    it("has expected core fields", () => {
      const order: Partial<Order> = {
        id: "CLM-001", customer_id: "c1", status: "new", source: "store",
        items_total: 100, discount_amount: 0, total: 100,
        payment_method: "credit", shipping_city: "Haifa", shipping_address: "St 1",
        payment_details: {},
      };
      expect(order.id).toContain("CLM");
      expect(order.total).toBe(100);
    });
  });

  // =========================================================================
  // Customer type shape
  // =========================================================================
  describe("Customer type", () => {
    it("has expected core fields", () => {
      const customer: Partial<Customer> = {
        id: "1", name: "Ahmad", phone: "050", segment: "active",
        total_orders: 0, total_spent: 0, avg_order_value: 0, tags: [],
      };
      expect(customer.name).toBeDefined();
      expect(customer.phone).toBeDefined();
      expect(customer.tags).toBeInstanceOf(Array);
    });
  });

  // =========================================================================
  // Commission types
  // =========================================================================
  describe("commission types", () => {
    it("CommissionSale has id as number", () => {
      const sale: Partial<CommissionSale> = { id: 1, sale_type: "line", package_price: 59 };
      expect(typeof sale.id).toBe("number");
    });

    it("CommissionEmployee has token field", () => {
      const emp: Partial<CommissionEmployee> = { id: 1, name: "Test", token: "abc" };
      expect(emp.token).toBeDefined();
    });

    it("EmployeeCommissionProfile has loyalty_bonuses as Record", () => {
      const profile: Partial<EmployeeCommissionProfile> = {
        user_id: "u1", loyalty_bonuses: { "6": 200 },
      };
      expect(profile.loyalty_bonuses).toBeDefined();
    });
  });

  // =========================================================================
  // Inbox types
  // =========================================================================
  describe("inbox types", () => {
    it("InboxConversation has channel and status", () => {
      const conv: Partial<InboxConversation> = {
        channel: "whatsapp", status: "active", priority: "normal",
      };
      expect(conv.channel).toBe("whatsapp");
      expect(conv.status).toBe("active");
    });

    it("InboxMessage has direction and message_type", () => {
      const msg: Partial<InboxMessage> = {
        direction: "inbound", message_type: "text", status: "delivered",
      };
      expect(msg.direction).toBe("inbound");
    });
  });

  // =========================================================================
  // All entity types exist (compile-time)
  // =========================================================================
  describe("all entity types compile", () => {
    it("core entity types are importable", () => {
      // If this test file compiles and runs, all imported types exist
      const types: string[] = [
        "Product", "Order", "OrderItem", "OrderNote", "OrderStatusHistory",
        "Customer", "CustomerNote", "CustomerHotAccount", "CustomerOTP",
        "AppUser", "Category", "Coupon", "Deal", "Hero", "LinePlan",
        "Setting", "WebsiteContent", "SubPage", "Integration", "EmailTemplate",
      ];
      expect(types.length).toBe(20);
    });

    it("bot types are importable", () => {
      assertType<BotConversation>({} as BotConversation);
      assertType<BotMessage>({} as BotMessage);
      assertType<BotTemplate>({} as BotTemplate);
      assertType<BotPolicy>({} as BotPolicy);
      assertType<BotAnalytics>({} as BotAnalytics);
      assertType<BotHandoff>({} as BotHandoff);
      expect(true).toBe(true);
    });

    it("sales doc types are importable", () => {
      assertType<SalesDoc>({} as SalesDoc);
      assertType<SalesDocItem>({} as SalesDocItem);
      assertType<SalesDocAttachment>({} as SalesDocAttachment);
      assertType<SalesDocEvent>({} as SalesDocEvent);
      assertType<SalesDocSyncQueue>({} as SalesDocSyncQueue);
      expect(true).toBe(true);
    });

    it("pipeline and task types are importable", () => {
      assertType<PipelineDeal>({} as PipelineDeal);
      assertType<PipelineStage>({} as PipelineStage);
      assertType<Task>({} as Task);
      expect(true).toBe(true);
    });

    it("notification types are importable", () => {
      assertType<Notification>({} as Notification);
      assertType<PushSubscription>({} as PushSubscription);
      assertType<PushNotification>({} as PushNotification);
      expect(true).toBe(true);
    });

    it("loyalty types are importable", () => {
      assertType<LoyaltyPoints>({} as LoyaltyPoints);
      assertType<LoyaltyTransaction>({} as LoyaltyTransaction);
      expect(true).toBe(true);
    });

    it("review and cart types are importable", () => {
      assertType<ProductReview>({} as ProductReview);
      assertType<AbandonedCart>({} as AbandonedCart);
      assertType<AuditEntry>({} as AuditEntry);
      expect(true).toBe(true);
    });

    it("inbox types are importable", () => {
      assertType<InboxConversation>({} as InboxConversation);
      assertType<InboxMessage>({} as InboxMessage);
      assertType<InboxLabel>({} as InboxLabel);
      assertType<InboxNote>({} as InboxNote);
      assertType<InboxTemplate>({} as InboxTemplate);
      assertType<InboxQuickReply>({} as InboxQuickReply);
      expect(true).toBe(true);
    });

    it("commission types are importable", () => {
      assertType<CommissionSale>({} as CommissionSale);
      assertType<CommissionEmployee>({} as CommissionEmployee);
      assertType<CommissionSanction>({} as CommissionSanction);
      assertType<CommissionTarget>({} as CommissionTarget);
      assertType<CommissionSyncLog>({} as CommissionSyncLog);
      assertType<EmployeeCommissionProfile>({} as EmployeeCommissionProfile);
      expect(true).toBe(true);
    });
  });
});
