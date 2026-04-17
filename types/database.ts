// =====================================================
// ClalMobile — Database Types
// Matches Supabase schema exactly
// =====================================================

export type Database = {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Product, "id">>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Order, "id">>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, "id">;
        Update: Partial<Omit<OrderItem, "id">>;
        Relationships: [];
      };
      order_notes: {
        Row: OrderNote;
        Insert: Omit<OrderNote, "id" | "created_at">;
        Update: Partial<Omit<OrderNote, "id">>;
        Relationships: [];
      };
      order_status_history: {
        Row: OrderStatusHistory;
        Insert: Omit<OrderStatusHistory, "id" | "created_at">;
        Update: Partial<Omit<OrderStatusHistory, "id">>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Customer, "id">>;
        Relationships: [];
      };
      customer_notes: {
        Row: CustomerNote;
        Insert: Omit<CustomerNote, "id" | "created_at">;
        Update: Partial<Omit<CustomerNote, "id">>;
        Relationships: [];
      };
      customer_hot_accounts: {
        Row: CustomerHotAccount;
        Insert: Omit<CustomerHotAccount, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CustomerHotAccount, "id">>;
        Relationships: [];
      };
      coupons: {
        Row: Coupon;
        Insert: Omit<Coupon, "id" | "created_at">;
        Update: Partial<Omit<Coupon, "id">>;
        Relationships: [];
      };
      heroes: {
        Row: Hero;
        Insert: Omit<Hero, "id" | "created_at">;
        Update: Partial<Omit<Hero, "id">>;
        Relationships: [];
      };
      line_plans: {
        Row: LinePlan;
        Insert: Omit<LinePlan, "id" | "created_at">;
        Update: Partial<Omit<LinePlan, "id">>;
        Relationships: [];
      };
      email_templates: {
        Row: EmailTemplate;
        Insert: Omit<EmailTemplate, "id" | "created_at">;
        Update: Partial<Omit<EmailTemplate, "id">>;
        Relationships: [];
      };
      settings: {
        Row: Setting;
        Insert: Setting;
        Update: Partial<Setting>;
        Relationships: [];
      };
      integrations: {
        Row: Integration;
        Insert: Omit<Integration, "id">;
        Update: Partial<Omit<Integration, "id">>;
        Relationships: [];
      };
      users: {
        Row: AppUser;
        Insert: Omit<AppUser, "id" | "created_at">;
        Update: Partial<Omit<AppUser, "id">>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Task, "id">>;
        Relationships: [];
      };
      pipeline_deals: {
        Row: PipelineDeal;
        Insert: Omit<PipelineDeal, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<PipelineDeal, "id">>;
        Relationships: [];
      };
      pipeline_stages: {
        Row: PipelineStage;
        Insert: Omit<PipelineStage, "id" | "created_at">;
        Update: Partial<Omit<PipelineStage, "id">>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditEntry;
        Insert: Omit<AuditEntry, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at">;
        Update: Partial<Omit<Category, "id">>;
        Relationships: [];
      };
      bot_conversations: {
        Row: BotConversation;
        Insert: Omit<BotConversation, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BotConversation, "id">>;
        Relationships: [];
      };
      bot_messages: {
        Row: BotMessage;
        Insert: Omit<BotMessage, "id" | "created_at">;
        Update: Partial<Omit<BotMessage, "id">>;
        Relationships: [];
      };
      bot_handoffs: {
        Row: BotHandoff;
        Insert: Omit<BotHandoff, "id" | "created_at">;
        Update: Partial<Omit<BotHandoff, "id">>;
        Relationships: [];
      };
      bot_policies: {
        Row: BotPolicy;
        Insert: Omit<BotPolicy, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BotPolicy, "id">>;
        Relationships: [];
      };
      abandoned_carts: {
        Row: AbandonedCart;
        Insert: Omit<AbandonedCart, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AbandonedCart, "id">>;
        Relationships: [];
      };
      product_reviews: {
        Row: ProductReview;
        Insert: Omit<ProductReview, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProductReview, "id">>;
        Relationships: [];
      };
      deals: {
        Row: Deal;
        Insert: Omit<Deal, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Deal, "id">>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: Omit<PushSubscription, "id" | "created_at">;
        Update: Partial<Omit<PushSubscription, "id">>;
        Relationships: [];
      };
      push_notifications: {
        Row: PushNotification;
        Insert: Omit<PushNotification, "id" | "sent_at">;
        Update: Partial<Omit<PushNotification, "id">>;
        Relationships: [];
      };
      bot_templates: {
        Row: BotTemplate;
        Insert: Omit<BotTemplate, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BotTemplate, "id">>;
        Relationships: [];
      };
      bot_analytics: {
        Row: BotAnalytics;
        Insert: Omit<BotAnalytics, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BotAnalytics, "id">>;
        Relationships: [];
      };
      customer_otps: {
        Row: CustomerOTP;
        Insert: Omit<CustomerOTP, "id" | "created_at">;
        Update: Partial<Omit<CustomerOTP, "id">>;
        Relationships: [];
      };
      website_content: {
        Row: WebsiteContent;
        Insert: Omit<WebsiteContent, "id" | "updated_at">;
        Update: Partial<Omit<WebsiteContent, "id">>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at">;
        Update: Partial<Omit<Notification, "id">>;
        Relationships: [];
      };
      loyalty_points: {
        Row: LoyaltyPoints;
        Insert: Omit<LoyaltyPoints, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<LoyaltyPoints, "id">>;
        Relationships: [];
      };
      loyalty_transactions: {
        Row: LoyaltyTransaction;
        Insert: Omit<LoyaltyTransaction, "id" | "created_at">;
        Update: Partial<Omit<LoyaltyTransaction, "id">>;
        Relationships: [];
      };
      commission_sales: {
        Row: CommissionSale;
        Insert: Omit<CommissionSale, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CommissionSale, "id">>;
        Relationships: [];
      };
      commission_targets: {
        Row: CommissionTarget;
        Insert: Omit<CommissionTarget, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CommissionTarget, "id">>;
        Relationships: [];
      };
      commission_sanctions: {
        Row: CommissionSanction;
        Insert: Omit<CommissionSanction, "id" | "created_at">;
        Update: Partial<Omit<CommissionSanction, "id">>;
        Relationships: [];
      };
      commission_sync_log: {
        Row: CommissionSyncLog;
        Insert: Omit<CommissionSyncLog, "id" | "sync_date">;
        Update: Partial<Omit<CommissionSyncLog, "id">>;
        Relationships: [];
      };
      employee_commission_profiles: {
        Row: EmployeeCommissionProfile;
        Insert: Omit<EmployeeCommissionProfile, "created_at" | "updated_at">;
        Update: Partial<Omit<EmployeeCommissionProfile, "user_id">>;
        Relationships: [];
      };
      commission_employees: {
        Row: CommissionEmployee;
        Insert: Omit<CommissionEmployee, "id" | "created_at" | "updated_at" | "token"> & { token?: string };
        Update: Partial<Omit<CommissionEmployee, "id">>;
        Relationships: [];
      };
      sales_docs: {
        Row: SalesDoc;
        Insert: Omit<SalesDoc, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SalesDoc, "id">>;
        Relationships: [];
      };
      sales_doc_items: {
        Row: SalesDocItem;
        Insert: Omit<SalesDocItem, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SalesDocItem, "id">>;
        Relationships: [];
      };
      sales_doc_attachments: {
        Row: SalesDocAttachment;
        Insert: Omit<SalesDocAttachment, "id" | "created_at">;
        Update: Partial<Omit<SalesDocAttachment, "id">>;
        Relationships: [];
      };
      sales_doc_events: {
        Row: SalesDocEvent;
        Insert: Omit<SalesDocEvent, "id" | "created_at">;
        Update: Partial<Omit<SalesDocEvent, "id">>;
        Relationships: [];
      };
      sales_doc_sync_queue: {
        Row: SalesDocSyncQueue;
        Insert: Omit<SalesDocSyncQueue, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SalesDocSyncQueue, "id">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// ===== Entity Types =====

export type Product = {
  id: string;
  type: "device" | "accessory";
  brand: string;
  name_ar: string;
  name_en?: string;
  name_he: string;
  description_ar?: string;
  description_he?: string;
  price: number;
  old_price?: number;
  cost: number;
  stock: number;
  sold: number;
  image_url?: string;
  gallery: string[];       // array of image URLs
  colors: ProductColor[];
  storage_options: string[];
  variants: ProductVariant[];  // per-storage pricing
  specs: Record<string, string>;
  category_id?: string;
  active: boolean;
  featured: boolean;
  sort_position?: number;
  created_at: string;
  updated_at: string;
}

export type ProductColor = {
  hex: string;
  name_ar: string;
  name_he: string;
  image?: string;           // صورة الجهاز بهذا اللون
}

export type ProductVariant = {
  storage: string;          // e.g. "256GB"
  price: number;
  old_price?: number;
  monthly_price?: number;   // قسط شهري ×36
  cost?: number;
  stock?: number;
}

export type WebsiteContent = {
  id: string;
  section: string;
  title_ar?: string;
  title_he?: string;
  subtitle_ar?: string;
  subtitle_he?: string;
  content: Record<string, any>;
  is_visible: boolean;
  sort_order: number;
  updated_at: string;
}

export type Order = {
  id: string;              // CLM-XXXXX
  customer_id: string;
  status: string;          // OrderStatus
  source: string;          // OrderSource
  items_total: number;
  discount_amount: number;
  total: number;
  coupon_code?: string;
  payment_method: string;  // "bank" | "credit" | "credit_direct"
  payment_status?: string;
  payment_details: Record<string, any>;
  shipping_city: string;
  shipping_address: string;
  customer_notes?: string;
  internal_notes?: string;
  assigned_to?: string;    // user_id
  created_by_id?: string;
  created_by_name?: string;
  deal_id?: string;
  commission_synced?: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_type: string;
  price: number;
  quantity: number;
  color?: string;
  storage?: string;
}

export type OrderNote = {
  id: string;
  order_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export type OrderStatusHistory = {
  id: string;
  order_id: string;
  old_status?: string;
  new_status: string;
  changed_by_id?: string;
  changed_by_name?: string;
  notes?: string;
  created_at: string;
}

export type Customer = {
  id: string;
  name: string;
  phone: string;
  customer_code?: string;
  email?: string;
  city?: string;
  address?: string;
  id_number?: string;     // Israeli ID
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order_at?: string;
  segment: string;         // CustomerSegment
  birthday?: string;
  tags: string[];
  source?: string;
  assigned_to?: string;
  created_by_id?: string;
  created_by_name?: string;
  gender?: string;
  preferred_language?: string;
  notes?: string;
  auth_token?: string;
  auth_token_expires_at?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export type CustomerHotAccount = {
  id: string;
  customer_id: string;
  hot_mobile_id?: string;
  hot_customer_code?: string;
  line_phone?: string;
  label?: string;
  status: "pending" | "verified" | "active" | "inactive" | "conflict" | "transferred";
  is_primary: boolean;
  source: string;
  source_order_id?: string;
  verified_at?: string;
  verified_by_id?: string;
  verified_by_name?: string;
  notes?: string;
  created_by_id?: string;
  created_by_name?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export type CustomerNote = {
  id: string;
  customer_id: string;
  user_id?: string;
  user_name: string;
  text: string;
  created_at: string;
}

export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  expires_at?: string;
  active: boolean;
  created_at: string;
}

export type Hero = {
  id: string;
  title_ar: string;
  title_he: string;
  subtitle_ar?: string;
  subtitle_he?: string;
  image_url?: string;
  link_url?: string;
  cta_text_ar?: string;
  cta_text_he?: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export type SubPage = {
  id: string;
  slug: string;
  title_ar: string;
  title_he: string;
  content_ar: string;
  content_he: string;
  image_url?: string;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type LinePlan = {
  id: string;
  name_ar: string;
  name_he: string;
  data_amount: string;     // "10GB", "50GB", "∞"
  price: number;
  features_ar: string[];
  features_he: string[];
  popular: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export type EmailTemplate = {
  id: string;
  slug: string;            // "order_confirmed", "order_shipped", etc
  name_ar: string;
  subject_ar: string;
  subject_he: string;
  body_html_ar: string;
  body_html_he: string;
  variables: string[];     // available template variables
  active: boolean;
  created_at: string;
}

export type Setting = {
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
}

export type Integration = {
  id: string;
  type: string;            // IntegrationType key
  provider: string;
  config: Record<string, any>;
  status: "active" | "inactive" | "error";
  last_synced_at?: string;
}

export type AppUser = {
  id: string;
  auth_id: string;         // Supabase Auth UID
  name: string;
  email: string;
  phone?: string;
  role: string;            // UserRole
  avatar_url?: string;
  status: "active" | "suspended";
  last_login_at?: string;
  created_at: string;
}

export type Task = {
  id: string;
  title: string;
  description?: string;
  customer_id?: string;
  order_id?: string;
  assigned_to?: string;    // user_id
  priority: string;        // TaskPriority
  status: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export type PipelineDeal = {
  id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  product_summary?: string;
  product_name?: string;
  product_id?: string;
  value: number;
  estimated_value?: number;
  stage: string;           // legacy stage mirror
  stage_id?: number;
  source: string;          // OrderSource
  assigned_to?: string;    // user_id
  employee_id?: string;
  employee_name?: string;
  notes?: string;
  order_id?: string;
  converted_at?: string;
  lost_reason?: string;
  created_at: string;
  updated_at: string;
}

export type PipelineStage = {
  id: number;
  name: string;
  name_he: string;
  name_ar?: string;
  sort_order: number;
  color?: string;
  is_won?: boolean;
  is_lost?: boolean;
  created_at: string;
}

export type AuditEntry = {
  id: string;
  user_id?: string;
  user_name: string;
  user_role?: string;
  action: string;
  module?: string;
  entity_type: string;     // "order", "product", "customer", etc
  entity_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export type Category = {
  id: string;
  name_ar: string;
  name_he: string;
  type: "auto" | "manual";
  rule?: string;           // for auto collections
  product_ids: string[];   // for manual collections
  sort_order: number;
  active: boolean;
  created_at: string;
}

// ===== Bot Tables (Season 5) =====

export type BotPolicy = {
  id: string;
  type: string;
  title_ar: string;
  title_he: string;
  content_ar: string;
  content_he: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type BotAnalytics = {
  id: string;
  date: string;
  channel: string;
  total_conversations: number;
  total_messages: number;
  handoffs: number;
  leads_captured?: number;
  avg_csat?: number;
  store_clicks: number;
  top_intents: Record<string, number>;
  top_products: Record<string, number>;
  created_at: string;
  updated_at: string;
}

// ===== Feature Tables (Season 6) =====

export type AbandonedCart = {
  id: string;
  visitor_id: string;
  customer_phone?: string;
  customer_name?: string;
  items: any[];
  total: number;
  reminder_sent: boolean;
  reminder_count: number;
  recovered: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductReview = {
  id: string;
  product_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  rating: number;
  title?: string;
  body?: string;
  verified_purchase: boolean;
  status: "pending" | "approved" | "rejected";
  admin_reply?: string;
  created_at: string;
  updated_at: string;
}

export type Deal = {
  id: string;
  title_ar: string;
  title_he: string;
  description_ar?: string;
  description_he?: string;
  product_id?: string;
  deal_type: "discount" | "flash_sale" | "bundle" | "clearance";
  discount_percent: number;
  discount_amount: number;
  original_price?: number;
  deal_price?: number;
  image_url?: string;
  badge_text_ar?: string;
  badge_text_he?: string;
  starts_at: string;
  ends_at?: string;
  max_quantity: number;
  sold_count: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PushSubscription = {
  id: string;
  endpoint: string;
  keys: Record<string, any>;
  visitor_id?: string;
  customer_phone?: string;
  user_agent?: string;
  active: boolean;
  created_at: string;
}

export type PushNotification = {
  id: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  sent_count: number;
  target: "all" | "segment" | "individual";
  target_filter: Record<string, any>;
  sent_at: string;
}

export type CustomerOTP = {
  id: string;
  phone: string;
  otp: string;
  expires_at: string;
  verified: boolean;
  created_at: string;
}

// ===== Inbox Types =====

export type InboxConversation = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  channel: "whatsapp" | "webchat";
  status: "active" | "waiting" | "bot" | "resolved" | "archived";
  assigned_to: string | null;
  assigned_at: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  pinned: boolean;
  is_blocked: boolean;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_direction: "inbound" | "outbound";
  first_response_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  source: string;
  metadata: Record<string, unknown>;
  sentiment: string | null;
  created_at: string;
  updated_at: string;
}

export type InboxMessage = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  sender_type: "customer" | "agent" | "bot" | "system";
  sender_id: string | null;
  sender_name: string | null;
  message_type: "text" | "image" | "document" | "audio" | "video" | "template" | "note" | "location";
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  template_name: string | null;
  template_params: Record<string, string> | null;
  reply_to_id: string | null;
  whatsapp_message_id: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type InboxLabel = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export type InboxNote = {
  id: string;
  conversation_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

export type InboxTemplate = {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
  is_active: boolean;
  usage_count: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InboxQuickReply = {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  usage_count: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ===== Bot Types =====

export type BotConversation = {
  id: string;
  visitor_id: string;
  channel: "webchat" | "whatsapp" | "sms";
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  language: string;
  status: "active" | "closed" | "escalated";
  intent: string | null;
  qualification: Record<string, unknown>;
  products_discussed: string[];
  source: string | null;
  message_count: number;
  csat_score: number | null;
  created_at: string;
  updated_at: string;
}

export type BotMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "bot" | "system";
  content: string;
  intent: string | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type BotHandoff = {
  id: string;
  conversation_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  reason: string;
  summary: string | null;
  products_interested: string[];
  last_price_quoted: number | null;
  status: "pending" | "assigned" | "resolved";
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type Notification = {
  id: string;
  user_id: string | null;
  type: "order" | "message" | "alert" | "info" | "task";
  title: string;
  body: string | null;
  link: string | null;
  icon: string;
  read: boolean;
  created_at: string;
}

export type BotTemplate = {
  id: string;
  key: string;
  content_ar: string;
  content_he: string | null;
  channel: "all" | "webchat" | "whatsapp";
  variables: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== Loyalty Program =====

export type LoyaltyPoints = {
  id: string;
  customer_id: string;
  points: number;
  lifetime_points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  created_at: string;
  updated_at: string;
}

export type LoyaltyTransaction = {
  id: string;
  customer_id: string;
  type: 'earn' | 'redeem' | 'expire' | 'bonus' | 'adjust';
  points: number;
  balance_after: number;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

export type CommissionSale = {
  id: number;
  user_id?: string | null;
  sale_date: string;
  sale_type: "line" | "device";
  source: "manual" | "auto_sync" | "csv_import";
  order_id?: string | null;
  customer_id?: string | null;
  customer_hot_account_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  hot_mobile_id_snapshot?: string | null;
  store_customer_code_snapshot?: string | null;
  match_status?: "pending" | "matched" | "ambiguous" | "unmatched" | "conflict" | "manual" | null;
  match_method?: string | null;
  match_confidence?: number | null;
  package_price: number;
  multiplier?: number;
  has_valid_hk: boolean;
  loyalty_status?: "pending" | "active" | "churned" | "cancelled" | null;
  loyalty_start_date?: string | null;
  device_name?: string | null;
  device_sale_amount: number;
  commission_amount: number;
  contract_commission?: number;
  employee_id?: string | null;
  employee_name?: string | null;
  notes?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CommissionTarget = {
  id: number;
  user_id?: string | null;
  month: string;
  target_lines_amount: number;
  target_devices_amount: number;
  target_total: number;
  target_lines_count?: number;
  target_devices_count?: number;
  is_locked?: boolean;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CommissionSanction = {
  id: number;
  user_id?: string | null;
  employee_id?: string | null;
  sanction_date: string;
  sanction_type: string;
  amount: number;
  has_sale_offset?: boolean;
  description?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

export type CommissionSyncLog = {
  id: number;
  sync_date: string;
  orders_synced: number;
  orders_skipped: number;
  total_amount: number;
  status: string;
  error_message?: string | null;
}

export type EmployeeCommissionProfile = {
  user_id: string;
  line_multiplier: number;
  device_rate: number;
  device_milestone_bonus: number;
  min_package_price: number;
  loyalty_bonuses: Record<string, number>;
  notes?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type CommissionEmployee = {
  id: number;
  name: string;
  phone?: string | null;
  token: string;
  role?: string | null;
  active: boolean;
  notes?: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type SalesDoc = {
  id: number;
  doc_uuid: string;
  employee_user_id?: string | null;
  employee_key: string;
  customer_id?: string | null;
  order_id?: string | null;
  sale_type: "line" | "device" | "mixed";
  status: "draft" | "submitted" | "verified" | "rejected" | "synced_to_commissions";
  sale_date?: string | null;
  total_amount: number;
  currency: string;
  source: string;
  created_by: string;
  submitted_at?: string | null;
  verified_at?: string | null;
  rejected_at?: string | null;
  synced_at?: string | null;
  rejection_reason?: string | null;
  notes?: string | null;
  device_client_id?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export type SalesDocItem = {
  id: number;
  sales_doc_id: number;
  item_type: "line" | "device" | "accessory";
  product_id?: string | null;
  product_name?: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export type SalesDocAttachment = {
  id: number;
  sales_doc_id: number;
  attachment_type: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  sha256?: string | null;
  uploaded_by: string;
  created_at: string;
  deleted_at?: string | null;
}

export type SalesDocEvent = {
  id: number;
  sales_doc_id: number;
  event_type: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export type SalesDocSyncQueue = {
  id: number;
  sales_doc_id: number;
  sync_target: string;
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  last_error?: string | null;
  next_retry_at?: string | null;
  created_at: string;
  updated_at: string;
}
