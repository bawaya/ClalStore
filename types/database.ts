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
      customers: {
        Row: Customer;
        Insert: Omit<Customer, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Customer, "id">>;
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

export type Customer = {
  id: string;
  name: string;
  phone: string;
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
  auth_token?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
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
  customer_name?: string;
  product_summary?: string;
  value: number;
  stage: string;           // PipelineStage
  source: string;          // OrderSource
  assigned_to?: string;    // user_id
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type AuditEntry = {
  id: string;
  user_id?: string;
  user_name: string;
  action: string;
  entity_type: string;     // "order", "product", "customer", etc
  entity_id?: string;
  details?: Record<string, any>;
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

export type BotConversation = {
  id: string;
  visitor_id: string;
  channel: "webchat" | "whatsapp" | "sms";
  status: "active" | "closed" | "escalated";
  language: string;
  intent?: string;
  qualification: Record<string, unknown>;
  products_discussed: string[];
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  source?: string;
  message_count: number;
  csat_score?: number;
  created_at: string;
  updated_at: string;
}

export type BotMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "bot" | "system";
  content: string;
  intent?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type BotHandoff = {
  id: string;
  conversation_id: string;
  customer_id?: string;
  reason: string;
  summary?: string;
  products_interested: string[];
  last_price_quoted?: number;
  customer_phone?: string;
  customer_name?: string;
  status: "pending" | "assigned" | "resolved";
  assigned_to?: string;
  resolved_at?: string;
  created_at: string;
}

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

export type BotTemplate = {
  id: string;
  key: string;
  content_ar: string;
  content_he: string;
  variables: string[];
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
