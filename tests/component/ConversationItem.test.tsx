import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { InboxConversation } from "@/lib/crm/inbox-types";

vi.mock("@/lib/crm/sentiment", () => ({
  analyzeSentiment: vi.fn(() => ({ sentiment: "neutral", confidence: 0.5, keywords: [] })),
  SENTIMENT_CONFIG: {
    positive: { emoji: "😊", label: "إيجابي", color: "text-green-400", dotColor: "bg-green-500" },
    neutral: { emoji: "😐", label: "محايد", color: "text-gray-400", dotColor: "bg-gray-500" },
    negative: { emoji: "😟", label: "سلبي", color: "text-yellow-400", dotColor: "bg-yellow-500" },
    angry: { emoji: "😡", label: "غاضب", color: "text-red-400", dotColor: "bg-red-500" },
  },
}));

import { ConversationItem } from "@/components/crm/inbox/ConversationItem";

function makeConversation(overrides: Partial<InboxConversation> = {}): InboxConversation {
  return {
    id: "conv-1",
    customer_phone: "+972501234567",
    customer_name: "أحمد محمد",
    channel: "whatsapp",
    status: "active",
    assigned_to: null,
    assigned_at: null,
    priority: "normal",
    pinned: false,
    is_blocked: false,
    unread_count: 0,
    last_message_text: "مرحبا، أريد الاستفسار",
    last_message_at: new Date().toISOString(),
    last_message_direction: "inbound",
    first_response_at: null,
    resolved_at: null,
    resolved_by: null,
    source: "whatsapp",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    labels: [],
    assigned_user: null,
    ...overrides,
  };
}

describe("ConversationItem", () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const conv = makeConversation();
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("أحمد محمد")).toBeInTheDocument();
  });

  it("displays customer name", () => {
    const conv = makeConversation();
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("أحمد محمد")).toBeInTheDocument();
  });

  it("displays customer phone when no name", () => {
    const conv = makeConversation({ customer_name: null });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("+972501234567")).toBeInTheDocument();
  });

  it("shows phone below name when name exists", () => {
    const conv = makeConversation();
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("+972501234567")).toBeInTheDocument();
  });

  it("shows last message snippet", () => {
    const conv = makeConversation({ last_message_text: "هل متوفر ايفون 15؟" });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("هل متوفر ايفون 15؟")).toBeInTheDocument();
  });

  it("shows 'أنت:' prefix for outbound last messages", () => {
    const conv = makeConversation({
      last_message_text: "نعم متوفر",
      last_message_direction: "outbound",
    });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("أنت:")).toBeInTheDocument();
  });

  it("shows unread count badge when unread > 0", () => {
    const conv = makeConversation({ unread_count: 5 });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not show unread badge when count is 0", () => {
    const conv = makeConversation({ unread_count: 0 });
    const { container } = render(
      <ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />
    );
    const badge = container.querySelector(".bg-red-500");
    expect(badge).toBeNull();
  });

  it("shows pinned indicator", () => {
    const conv = makeConversation({ pinned: true });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("📌")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const conv = makeConversation();
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("applies selected styling when isSelected is true", () => {
    const conv = makeConversation();
    render(<ConversationItem conversation={conv} isSelected={true} onClick={mockOnClick} />);
    const button = screen.getByRole("button");
    expect(button.style.borderInlineStart).toContain("3px solid");
  });

  it("shows labels when provided", () => {
    const conv = makeConversation({
      labels: [
        { id: "l1", name: "VIP", color: "#c41040", description: null, sort_order: 0, created_at: "" },
      ],
    });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it("shows assigned user when set", () => {
    const conv = makeConversation({
      assigned_to: "user-1",
      assigned_user: { id: "user-1", name: "سارة" },
    });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText(/سارة/)).toBeInTheDocument();
  });

  it("shows sentiment emoji", () => {
    const conv = makeConversation();
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    // Should display neutral emoji from SENTIMENT_CONFIG
    expect(screen.getByText("😐")).toBeInTheDocument();
  });

  it("shows time ago text", () => {
    const conv = makeConversation({ last_message_at: new Date().toISOString() });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    expect(screen.getByText("الآن")).toBeInTheDocument();
  });

  it("truncates long snippets", () => {
    const longText = "هذه رسالة طويلة جدا جدا تحتوي على كلمات كثيرة ويجب قصها حتى لا تأخذ مساحة كبيرة في العرض";
    const conv = makeConversation({ last_message_text: longText });
    render(<ConversationItem conversation={conv} isSelected={false} onClick={mockOnClick} />);
    // Should show truncated to 50 chars
    const snippet = screen.getByText(/هذه رسالة طويلة/);
    expect(snippet.textContent!.length).toBeLessThanOrEqual(50);
  });
});
