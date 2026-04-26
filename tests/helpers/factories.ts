/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test data factories — one per database table.
 * Each factory returns a full Row object with sensible defaults;
 * pass an overrides partial to customise specific fields.
 */

import type {
  Product, Order, OrderItem, OrderNote, OrderStatusHistory,
  Customer, CustomerNote, CustomerHotAccount, CustomerOTP,
  AppUser, Category, Coupon, Deal, Hero, LinePlan, Setting,
  WebsiteContent, SubPage, Integration, IntegrationSecret, EmailTemplate,
  InboxConversation, InboxMessage, InboxLabel, InboxConversationLabel, InboxNote,
  InboxTemplate, InboxQuickReply, InboxEvent,
  BotConversation, BotMessage, BotTemplate, BotPolicy,
  BotAnalytics, BotHandoff,
  CommissionSale, CommissionEmployee, CommissionSanction,
  CommissionTarget, CommissionSyncLog, EmployeeCommissionProfile,
  PipelineDeal, PipelineStage, Task,
  Notification, PushSubscription, PushNotification,
  LoyaltyPoints, LoyaltyTransaction,
  ProductReview, AbandonedCart, AuditEntry,
  SalesDoc, SalesDocItem, SalesDocAttachment, SalesDocEvent, SalesDocSyncQueue,
} from "@/types/database";

let _seq = 0;
function seq() { return ++_seq; }
function uuid() { return `test-${seq()}-${Math.random().toString(36).slice(2, 8)}`; }
function now() { return new Date().toISOString(); }

// ───── Core Commerce ─────

export function makeProduct(o: Partial<Product> = {}): Product {
  return {
    id: uuid(), type: "device", brand: "Apple",
    name_ar: "آيفون 15", name_he: "אייפון 15", name_en: "iPhone 15",
    description_ar: "هاتف ذكي", description_he: "סמארטפון",
    price: 3499, old_price: 3999, cost: 2500,
    stock: 50, sold: 10, image_url: "/img/iphone15.jpg",
    gallery: ["/img/1.jpg"], colors: [{ hex: "#000", name_ar: "أسود", name_he: "שחור" }],
    storage_options: ["128GB", "256GB"],
    variants: [{ storage: "128GB", price: 3499 }, { storage: "256GB", price: 3999 }],
    specs: { screen: "6.1", battery: "3349mAh" },
    category_id: undefined, active: true, featured: false,
    sort_position: 0, created_at: now(), updated_at: now(),
    ...o,
  };
}

export function makeOrder(o: Partial<Order> = {}): Order {
  return {
    id: `CLM-${seq()}`, customer_id: uuid(), status: "new", source: "store",
    items_total: 3499, discount_amount: 0, total: 3499,
    coupon_code: undefined, payment_method: "credit",
    payment_status: "pending", payment_details: {},
    shipping_city: "חיפה", shipping_address: "רחוב 1",
    customer_notes: undefined, internal_notes: undefined,
    assigned_to: undefined, created_by_id: undefined, created_by_name: undefined,
    deal_id: undefined, commission_synced: false, deleted_at: null,
    excluded_from_sync: false, cancelled_at_customer: null, cancelled_by: null,
    cancellation_reason: null, cancellation_fee: null, cancellation_refund: null,
    extended_cancel_window: false,
    created_at: now(), updated_at: now(), ...o,
  };
}

export function makeOrderItem(o: Partial<OrderItem> = {}): OrderItem {
  return {
    id: uuid(), order_id: `CLM-${seq()}`, product_id: uuid(),
    product_name: "iPhone 15", product_brand: "Apple", product_type: "device",
    price: 3499, quantity: 1, color: "Black", storage: "128GB", ...o,
  };
}

export function makeOrderNote(o: Partial<OrderNote> = {}): OrderNote {
  return { id: uuid(), order_id: `CLM-${seq()}`, user_id: uuid(), user_name: "Admin", text: "Note", created_at: now(), ...o };
}

export function makeOrderStatusHistory(o: Partial<OrderStatusHistory> = {}): OrderStatusHistory {
  return { id: uuid(), order_id: `CLM-${seq()}`, old_status: "new", new_status: "approved", changed_by_id: uuid(), changed_by_name: "Admin", notes: undefined, created_at: now(), ...o };
}

// ───── Customers ─────

export function makeCustomer(o: Partial<Customer> = {}): Customer {
  return {
    id: uuid(), name: "أحمد", phone: "0501234567", customer_code: "CLAL-001",
    email: "test@test.com", city: "חיפה", address: "רחוב 1",
    id_number: undefined, total_orders: 5, total_spent: 15000, avg_order_value: 3000,
    last_order_at: now(), segment: "active", birthday: undefined,
    tags: ["vip"], source: "store", assigned_to: undefined,
    created_by_id: undefined, created_by_name: undefined,
    gender: undefined, preferred_language: "ar", notes: undefined,
    auth_token: undefined, auth_token_expires_at: null, last_login: undefined,
    created_at: now(), updated_at: now(), ...o,
  };
}

export function makeCustomerNote(o: Partial<CustomerNote> = {}): CustomerNote {
  return { id: uuid(), customer_id: uuid(), user_id: uuid(), user_name: "Admin", text: "Customer note", created_at: now(), ...o };
}

export function makeCustomerHotAccount(o: Partial<CustomerHotAccount> = {}): CustomerHotAccount {
  return {
    id: uuid(), customer_id: uuid(), hot_mobile_id: "HOT123", hot_customer_code: "HC001",
    line_phone: "0521111111", label: "Main line", status: "active", is_primary: true,
    source: "manual", source_order_id: undefined, verified_at: now(), verified_by_id: uuid(),
    verified_by_name: "Admin", notes: undefined, created_by_id: undefined, created_by_name: undefined,
    ended_at: undefined, created_at: now(), updated_at: now(), ...o,
  };
}

export function makeCustomerOTP(o: Partial<CustomerOTP> = {}): CustomerOTP {
  return { id: uuid(), phone: "0501234567", otp: "123456", expires_at: new Date(Date.now() + 300_000).toISOString(), verified: false, created_at: now(), ...o };
}

// ───── Users & Auth ─────

export function makeUser(o: Partial<AppUser> = {}): AppUser {
  return {
    id: uuid(), auth_id: uuid(), name: "Admin User", email: "admin@test.com",
    phone: "0501234567", role: "super_admin", avatar_url: undefined,
    status: "active", must_change_password: false, temp_password_expires_at: null,
    invited_by: null, invited_at: null, last_login_at: now(), created_at: now(), ...o,
  };
}

// ───── Catalog ─────

export function makeCategory(o: Partial<Category> = {}): Category {
  return { id: uuid(), name_ar: "هواتف", name_he: "טלפונים", type: "manual", rule: undefined, product_ids: [], sort_order: 0, active: true, created_at: now(), ...o };
}

export function makeCoupon(o: Partial<Coupon> = {}): Coupon {
  return { id: uuid(), code: "SAVE10", type: "percent", value: 10, min_order: 0, max_uses: 100, used_count: 0, expires_at: undefined, active: true, created_at: now(), ...o };
}

export function makeDeal(o: Partial<Deal> = {}): Deal {
  return {
    id: uuid(), title_ar: "عرض", title_he: "מבצע", description_ar: undefined, description_he: undefined,
    product_id: undefined, deal_type: "discount", discount_percent: 15, discount_amount: 0,
    original_price: undefined, deal_price: undefined, image_url: undefined,
    badge_text_ar: undefined, badge_text_he: undefined,
    starts_at: now(), ends_at: undefined, max_quantity: 100, sold_count: 0,
    active: true, sort_order: 0, created_at: now(), updated_at: now(), ...o,
  };
}

export function makeHero(o: Partial<Hero> = {}): Hero {
  return {
    id: uuid(), title_ar: "بطل", title_he: "גיבור", subtitle_ar: undefined, subtitle_he: undefined,
    image_url: "/hero.jpg", link_url: "/store", cta_text_ar: "تسوق", cta_text_he: "קנה",
    sort_order: 0, active: true, created_at: now(), ...o,
  };
}

export function makeLinePlan(o: Partial<LinePlan> = {}): LinePlan {
  return {
    id: uuid(), name_ar: "خطة أساسية", name_he: "תוכנית בסיסית",
    data_amount: "10GB", price: 29, features_ar: ["مكالمات"], features_he: ["שיחות"],
    popular: false, active: true, sort_order: 0, created_at: now(), ...o,
  };
}

// ───── Settings & Content ─────

export function makeSetting(o: Partial<Setting> = {}): Setting {
  return { key: "site_name", value: "ClalMobile", type: "string", ...o };
}

export function makeWebsiteContent(o: Partial<WebsiteContent> = {}): WebsiteContent {
  return { id: uuid(), section: "hero", title_ar: "عنوان", title_he: "כותרת", subtitle_ar: undefined, subtitle_he: undefined, content: {}, is_visible: true, sort_order: 0, updated_at: now(), ...o };
}

export function makeSubPage(o: Partial<SubPage> = {}): SubPage {
  return { id: uuid(), slug: "about", title_ar: "عن", title_he: "אודות", content_ar: "محتوى", content_he: "תוכן", image_url: undefined, is_visible: true, sort_order: 0, created_at: now(), updated_at: now(), ...o };
}

export function makeIntegration(o: Partial<Integration> = {}): Integration {
  return { id: uuid(), type: "whatsapp", provider: "ycloud", config: { api_key: "test" }, status: "active", last_synced_at: undefined, ...o };
}

export function makeIntegrationSecret(o: Partial<IntegrationSecret> = {}): IntegrationSecret {
  return {
    id: uuid(), integration_id: uuid(), secret_key: "api_key", encrypted_value: "enc_test_value",
    value_hint: "****1234", key_version: 1, created_at: now(), updated_at: now(), updated_by: null, ...o,
  };
}

export function makeEmailTemplate(o: Partial<EmailTemplate> = {}): EmailTemplate {
  return { id: uuid(), slug: "order_confirmed", name_ar: "تأكيد", subject_ar: "طلبك", subject_he: "ההזמנה", body_html_ar: "<p>شكرا</p>", body_html_he: "<p>תודה</p>", variables: ["orderId"], active: true, created_at: now(), ...o };
}

// ───── Inbox ─────

export function makeInboxConversation(o: Partial<InboxConversation> = {}): InboxConversation {
  return {
    id: uuid(), customer_phone: "0501234567", customer_name: "Ahmad",
    channel: "whatsapp", status: "active", assigned_to: null, assigned_at: null,
    priority: "normal", pinned: false, is_blocked: false, unread_count: 1,
    last_message_text: "مرحبا", last_message_at: now(), last_message_direction: "inbound",
    first_response_at: null, resolved_at: null, resolved_by: null,
    source: "direct", metadata: {}, sentiment: null,
    created_at: now(), updated_at: now(), ...o,
  };
}

export function makeInboxMessage(o: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: uuid(), conversation_id: uuid(), direction: "inbound",
    sender_type: "customer", sender_id: null, sender_name: "Ahmad",
    message_type: "text", content: "مرحبا", media_url: null,
    media_mime_type: null, media_filename: null,
    template_name: null, template_params: null, reply_to_id: null,
    whatsapp_message_id: null, status: "delivered", error_message: null,
    metadata: {}, created_at: now(), ...o,
  };
}

export function makeInboxLabel(o: Partial<InboxLabel> = {}): InboxLabel {
  return { id: uuid(), name: "VIP", color: "#FFD700", description: null, sort_order: 0, created_at: now(), ...o };
}

export function makeInboxConversationLabel(o: Partial<InboxConversationLabel> = {}): InboxConversationLabel {
  return { conversation_id: uuid(), label_id: uuid(), ...o };
}

export function makeInboxNote(o: Partial<InboxNote> = {}): InboxNote {
  return { id: uuid(), conversation_id: uuid(), author_id: uuid(), author_name: "Admin", content: "Note text", created_at: now(), ...o };
}

export function makeInboxTemplate(o: Partial<InboxTemplate> = {}): InboxTemplate {
  return { id: uuid(), name: "Welcome", category: "welcome", content: "مرحبا {{name}}", variables: ["name"], is_active: true, usage_count: 0, sort_order: 0, created_by: null, created_at: now(), updated_at: now(), ...o };
}

export function makeInboxQuickReply(o: Partial<InboxQuickReply> = {}): InboxQuickReply {
  return { id: uuid(), shortcut: "/hi", title: "تحية", content: "مرحبا!", category: "general", usage_count: 0, sort_order: 0, is_active: true, created_at: now(), ...o };
}

// ───── Bot ─────

export function makeInboxEvent(o: Partial<InboxEvent> = {}): InboxEvent {
  return {
    id: uuid(), conversation_id: uuid(), event_type: "status_changed",
    actor_id: uuid(), actor_name: "Admin", old_value: "active", new_value: "resolved",
    created_at: now(), ...o,
  };
}

export function makeBotConversation(o: Partial<BotConversation> = {}): BotConversation {
  return {
    id: uuid(), visitor_id: uuid(), channel: "webchat", customer_id: null,
    customer_name: null, customer_phone: null, language: "ar",
    status: "active", intent: null, qualification: {}, products_discussed: [],
    source: null, message_count: 0, csat_score: null,
    created_at: now(), updated_at: now(), ...o,
  };
}

export function makeBotMessage(o: Partial<BotMessage> = {}): BotMessage {
  return { id: uuid(), conversation_id: uuid(), role: "user", content: "مرحبا", intent: null, confidence: null, metadata: {}, created_at: now(), ...o };
}

export function makeBotTemplate(o: Partial<BotTemplate> = {}): BotTemplate {
  return { id: uuid(), key: "welcome", content_ar: "مرحبا!", content_he: null, channel: "all", variables: null, active: true, created_at: now(), updated_at: now(), ...o };
}

export function makeBotPolicy(o: Partial<BotPolicy> = {}): BotPolicy {
  return { id: uuid(), type: "warranty", title_ar: "ضمان", title_he: "אחריות", content_ar: "سنة واحدة", content_he: "שנה אחת", active: true, created_at: now(), updated_at: now(), ...o };
}

export function makeBotAnalytics(o: Partial<BotAnalytics> = {}): BotAnalytics {
  return { id: uuid(), date: now().split("T")[0], channel: "webchat", total_conversations: 10, total_messages: 50, handoffs: 2, leads_captured: 5, avg_csat: 4.2, store_clicks: 20, top_intents: { greeting: 15 }, top_products: {}, created_at: now(), updated_at: now(), ...o };
}

export function makeBotHandoff(o: Partial<BotHandoff> = {}): BotHandoff {
  return { id: uuid(), conversation_id: uuid(), customer_id: null, customer_name: "Ahmad", customer_phone: "0501234567", reason: "human_request", summary: null, products_interested: [], last_price_quoted: null, status: "pending", assigned_to: null, resolved_at: null, created_at: now(), ...o };
}

// ───── Commissions ─────

export function makeCommissionSale(o: Partial<CommissionSale> = {}): CommissionSale {
  return {
    id: seq(), user_id: uuid(), sale_date: now().split("T")[0], sale_type: "line",
    source: "manual", order_id: null, customer_id: null, customer_hot_account_id: null,
    customer_name: "Ahmad", customer_phone: "0501234567",
    hot_mobile_id_snapshot: null, store_customer_code_snapshot: null,
    match_status: null, match_method: null, match_confidence: null,
    package_price: 59, multiplier: 1, has_valid_hk: true,
    loyalty_status: null, loyalty_start_date: null,
    device_name: null, device_sale_amount: 0, commission_amount: 45,
    contract_commission: undefined, rate_snapshot: null, source_sales_doc_id: null,
    source_pipeline_deal_id: null, employee_id: null, employee_name: null,
    notes: null, deleted_at: null, created_at: now(), updated_at: now(), ...o,
  };
}

export function makeCommissionEmployee(o: Partial<CommissionEmployee> = {}): CommissionEmployee {
  return { id: seq(), name: "Sami", phone: "0509876543", token: "emp-token-123", role: "sales", active: true, notes: null, user_id: uuid(), created_at: now(), updated_at: now(), ...o };
}

export function makeCommissionSanction(o: Partial<CommissionSanction> = {}): CommissionSanction {
  return { id: seq(), user_id: uuid(), employee_id: null, sanction_date: now().split("T")[0], sanction_type: "deduction", amount: 50, has_sale_offset: false, description: "Test sanction", deleted_at: null, created_at: now(), ...o };
}

export function makeCommissionTarget(o: Partial<CommissionTarget> = {}): CommissionTarget {
  return { id: seq(), user_id: uuid(), month: "2026-04", target_lines_amount: 5000, target_devices_amount: 10000, target_total: 15000, target_lines_count: undefined, target_devices_count: undefined, is_locked: false, locked_at: null, created_at: now(), updated_at: now(), ...o };
}

export function makeCommissionSyncLog(o: Partial<CommissionSyncLog> = {}): CommissionSyncLog {
  return { id: seq(), sync_date: now(), orders_synced: 10, orders_skipped: 2, total_amount: 5000, status: "success", error_message: null, ...o };
}

export function makeEmployeeCommissionProfile(o: Partial<EmployeeCommissionProfile> = {}): EmployeeCommissionProfile {
  return { user_id: uuid(), line_multiplier: 1.0, device_rate: 0.03, device_milestone_bonus: 300, appliance_rate: 0.03, appliance_milestone_bonus: 0, min_package_price: 39, loyalty_bonuses: { "6": 200, "12": 500 }, notes: null, active: true, created_at: now(), updated_at: now(), ...o };
}

// ───── Pipeline ─────

export function makePipelineDeal(o: Partial<PipelineDeal> = {}): PipelineDeal {
  return {
    id: uuid(), customer_id: undefined, customer_name: "Ahmad", customer_phone: "0501234567",
    customer_email: undefined, product_summary: "iPhone 15", product_name: "iPhone 15",
    product_id: undefined, value: 3499, estimated_value: undefined, stage: "lead",
    stage_id: undefined, source: "whatsapp", assigned_to: undefined,
    employee_id: undefined, employee_name: undefined, notes: undefined,
    order_id: undefined, converted_at: undefined, lost_reason: undefined,
    created_at: now(), updated_at: now(), ...o,
  };
}

export function makePipelineStage(o: Partial<PipelineStage> = {}): PipelineStage {
  return { id: seq(), name: "Lead", name_he: "ליד", name_ar: "عميل محتمل", sort_order: 0, color: "#3B82F6", is_won: false, is_lost: false, created_at: now(), ...o };
}

export function makeTask(o: Partial<Task> = {}): Task {
  return { id: uuid(), title: "Follow up", description: undefined, customer_id: undefined, order_id: undefined, assigned_to: undefined, priority: "medium", status: "pending", due_date: undefined, created_at: now(), updated_at: now(), ...o };
}

// ───── Notifications & Push ─────

export function makeNotification(o: Partial<Notification> = {}): Notification {
  return { id: uuid(), user_id: uuid(), type: "order", title: "New Order", body: "Order received", link: "/admin/orders", icon: "📦", read: false, created_at: now(), ...o };
}

export function makePushSubscription(o: Partial<PushSubscription> = {}): PushSubscription {
  return { id: uuid(), endpoint: "https://fcm.test/send", keys: { p256dh: "key1", auth: "key2" }, visitor_id: uuid(), customer_phone: undefined, user_agent: "test-browser", active: true, created_at: now(), ...o };
}

export function makePushNotification(o: Partial<PushNotification> = {}): PushNotification {
  return { id: uuid(), title: "Sale!", body: "Big sale today", url: "/deals", icon: "🔥", sent_count: 0, target: "all", target_filter: {}, sent_at: now(), ...o };
}

// ───── Loyalty ─────

export function makeLoyaltyPoints(o: Partial<LoyaltyPoints> = {}): LoyaltyPoints {
  return { id: uuid(), customer_id: uuid(), points: 100, lifetime_points: 500, tier: "silver", created_at: now(), updated_at: now(), ...o };
}

export function makeLoyaltyTransaction(o: Partial<LoyaltyTransaction> = {}): LoyaltyTransaction {
  return { id: uuid(), customer_id: uuid(), type: "earn", points: 50, balance_after: 150, description: "Order reward", order_id: null, created_at: now(), ...o };
}

// ───── Reviews ─────

export function makeProductReview(o: Partial<ProductReview> = {}): ProductReview {
  return { id: uuid(), product_id: uuid(), customer_id: uuid(), customer_name: "Ahmad", customer_phone: "0501234567", rating: 5, title: "Great!", body: "Excellent phone", verified_purchase: true, status: "approved", admin_reply: undefined, created_at: now(), updated_at: now(), ...o };
}

// ───── Abandoned Carts ─────

export function makeAbandonedCart(o: Partial<AbandonedCart> = {}): AbandonedCart {
  return { id: uuid(), visitor_id: uuid(), customer_phone: undefined, customer_name: undefined, items: [{ name: "iPhone 15", price: 3499, qty: 1 }], total: 3499, reminder_sent: false, reminder_count: 0, recovered: false, created_at: now(), updated_at: now(), ...o };
}

// ───── Audit ─────

export function makeAuditEntry(o: Partial<AuditEntry> = {}): AuditEntry {
  return { id: uuid(), user_id: uuid(), user_name: "Admin", user_role: "super_admin", action: "create", module: "products", entity_type: "product", entity_id: uuid(), details: {}, ip_address: "127.0.0.1", created_at: now(), ...o };
}

// ───── Sales Docs ─────

export function makeSalesDoc(o: Partial<SalesDoc> = {}): SalesDoc {
  return {
    id: seq(), doc_uuid: uuid(), employee_user_id: uuid(), employee_key: "emp-1",
    customer_id: null, order_id: null, sale_type: "device", status: "draft",
    sale_date: now().split("T")[0], total_amount: 3499, currency: "ILS", source: "pwa",
    created_by: uuid(), submitted_at: null, verified_at: null, rejected_at: null,
    synced_at: null, rejection_reason: null, notes: null, device_client_id: null,
    idempotency_key: null, cancelled_at: null, cancelled_by: null, cancellation_reason: null,
    created_at: now(), updated_at: now(), deleted_at: null, ...o,
  };
}

export function makeSalesDocItem(o: Partial<SalesDocItem> = {}): SalesDocItem {
  return { id: seq(), sales_doc_id: 1, item_type: "device", product_id: null, product_name: "iPhone 15", qty: 1, unit_price: 3499, line_total: 3499, metadata: {}, created_at: now(), updated_at: now(), deleted_at: null, ...o };
}

export function makeSalesDocAttachment(o: Partial<SalesDocAttachment> = {}): SalesDocAttachment {
  return { id: seq(), sales_doc_id: 1, attachment_type: "photo", file_path: "/docs/photo.jpg", file_name: "photo.jpg", mime_type: "image/jpeg", file_size: 12345, sha256: null, uploaded_by: uuid(), created_at: now(), deleted_at: null, ...o };
}

export function makeSalesDocEvent(o: Partial<SalesDocEvent> = {}): SalesDocEvent {
  return { id: seq(), sales_doc_id: 1, event_type: "created", actor_user_id: uuid(), actor_role: "sales", payload: {}, created_at: now(), ...o };
}

export function makeSalesDocSyncQueue(o: Partial<SalesDocSyncQueue> = {}): SalesDocSyncQueue {
  return { id: seq(), sales_doc_id: 1, sync_target: "commissions", status: "pending", attempts: 0, last_error: null, next_retry_at: null, created_at: now(), updated_at: now(), ...o };
}
