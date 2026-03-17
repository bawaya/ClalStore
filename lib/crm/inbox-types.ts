// =====================================================
// ClalMobile — WhatsApp Inbox Types
// =====================================================

export type ConversationStatus = "active" | "waiting" | "bot" | "resolved" | "archived";
export type ConversationChannel = "whatsapp" | "webchat";
export type Priority = "low" | "normal" | "high" | "urgent";
export type MessageDirection = "inbound" | "outbound";
export type SenderType = "customer" | "agent" | "bot" | "system";
export type MessageType = "text" | "image" | "document" | "audio" | "video" | "template" | "note" | "location";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type TemplateCategory = "welcome" | "orders" | "shipping" | "payment" | "offers" | "followup" | "general";

export interface InboxConversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  priority: Priority;
  pinned: boolean;
  is_blocked: boolean;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_direction: MessageDirection;
  first_response_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  sentiment?: string;
  // Joined fields
  labels?: InboxLabel[];
  assigned_user?: { id: string; name: string } | null;
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender_type: SenderType;
  sender_id: string | null;
  sender_name: string | null;
  message_type: MessageType;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  template_name: string | null;
  template_params: Record<string, string> | null;
  reply_to_id: string | null;
  whatsapp_message_id: string | null;
  status: MessageStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined
  reply_to?: InboxMessage | null;
}

export interface InboxLabel {
  id: string;
  name: string;
  color: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface InboxNote {
  id: string;
  conversation_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

export interface InboxTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  content: string;
  variables: string[];
  is_active: boolean;
  usage_count: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxQuickReply {
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

export interface InboxEvent {
  id: string;
  conversation_id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface InboxStats {
  total_conversations: number;
  active: number;
  waiting: number;
  bot: number;
  resolved_today: number;
  messages_today: number;
  unread_total: number;
}

export interface ConversationDetail {
  conversation: InboxConversation;
  messages: InboxMessage[];
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    city?: string;
    address?: string;
    total_orders: number;
    total_spent: number;
    segment: string;
    tags: string[];
    created_at: string;
  } | null;
  labels: InboxLabel[];
  notes: InboxNote[];
  has_more: boolean;
}

// Status config for UI
export const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string; dot: string }> = {
  active: { label: "نشطة", color: "text-green-400", dot: "bg-green-500" },
  waiting: { label: "بانتظار", color: "text-yellow-400", dot: "bg-yellow-500" },
  bot: { label: "بوت", color: "text-blue-400", dot: "bg-blue-500" },
  resolved: { label: "محلولة", color: "text-gray-400", dot: "bg-gray-500" },
  archived: { label: "أرشيف", color: "text-gray-500", dot: "bg-gray-600" },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "text-gray-400" },
  normal: { label: "عادية", color: "text-blue-400" },
  high: { label: "عالية", color: "text-orange-400" },
  urgent: { label: "عاجلة", color: "text-red-400" },
};

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string; icon: string }[] = [
  { value: "welcome", label: "ترحيب", icon: "👋" },
  { value: "orders", label: "طلبات", icon: "📦" },
  { value: "shipping", label: "شحن", icon: "🚚" },
  { value: "payment", label: "دفع", icon: "💳" },
  { value: "offers", label: "عروض", icon: "🎁" },
  { value: "followup", label: "متابعة", icon: "🔄" },
  { value: "general", label: "عام", icon: "📝" },
];
