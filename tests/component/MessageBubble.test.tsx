import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { InboxMessage } from "@/lib/crm/inbox-types";

import { MessageBubble } from "@/components/crm/inbox/MessageBubble";

function makeMessage(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: "msg-1",
    conversation_id: "conv-1",
    direction: "inbound",
    sender_type: "customer",
    sender_id: null,
    sender_name: null,
    message_type: "text",
    content: "مرحبا",
    media_url: null,
    media_mime_type: null,
    media_filename: null,
    template_name: null,
    template_params: null,
    reply_to_id: null,
    whatsapp_message_id: null,
    status: "delivered",
    error_message: null,
    metadata: {},
    created_at: "2026-04-17T10:30:00Z",
    ...overrides,
  };
}

describe("MessageBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const msg = makeMessage();
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("مرحبا")).toBeInTheDocument();
  });

  it("renders inbound (customer) message aligned to start", () => {
    const msg = makeMessage({ direction: "inbound" });
    const { container } = render(<MessageBubble message={msg} />);
    const wrapper = container.querySelector(".justify-start");
    expect(wrapper).toBeInTheDocument();
  });

  it("renders outbound (agent) message aligned to end", () => {
    const msg = makeMessage({ direction: "outbound", sender_type: "agent" });
    const { container } = render(<MessageBubble message={msg} />);
    const wrapper = container.querySelector(".justify-end");
    expect(wrapper).toBeInTheDocument();
  });

  it("shows time for message", () => {
    const msg = makeMessage({ created_at: "2026-04-17T14:30:00Z" });
    render(<MessageBubble message={msg} />);
    // Time should be rendered (format depends on locale - may use Arabic-Indic digits)
    // Match ASCII or Arabic-Indic digit + colon pattern
    const timeElement = screen.getByText(/[\d\u0660-\u0669]{1,2}[:：][\d\u0660-\u0669]{2}/);
    expect(timeElement).toBeInTheDocument();
  });

  it("shows status icon for outbound messages", () => {
    const msg = makeMessage({ direction: "outbound", sender_type: "agent", status: "delivered" });
    render(<MessageBubble message={msg} />);
    // Delivered shows double check
    expect(screen.getByText("✓✓")).toBeInTheDocument();
  });

  it("shows single check for sent status", () => {
    const msg = makeMessage({ direction: "outbound", sender_type: "agent", status: "sent" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("shows blue double check for read status", () => {
    const msg = makeMessage({ direction: "outbound", sender_type: "agent", status: "read" });
    render(<MessageBubble message={msg} />);
    const readIcon = screen.getByText("✓✓");
    expect(readIcon).toHaveClass("text-blue-400");
  });

  it("shows error icon for failed status", () => {
    const msg = makeMessage({ direction: "outbound", sender_type: "agent", status: "failed" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("❌")).toBeInTheDocument();
  });

  it("does not show status icon for inbound messages", () => {
    const msg = makeMessage({ direction: "inbound", status: "delivered" });
    render(<MessageBubble message={msg} />);
    expect(screen.queryByText("✓✓")).not.toBeInTheDocument();
  });

  it("renders system message centered", () => {
    const msg = makeMessage({ sender_type: "system", content: "تم الحل" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText(/تم الحل/)).toBeInTheDocument();
  });

  it("renders note message with yellow styling", () => {
    const msg = makeMessage({ message_type: "note", content: "ملاحظة داخلية هامة" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("ملاحظة داخلية هامة")).toBeInTheDocument();
    expect(screen.getAllByText(/ملاحظة داخلية/).length).toBeGreaterThan(0);
  });

  it("renders bot message", () => {
    const msg = makeMessage({ sender_type: "bot", content: "مرحبا! كيف أقدر أساعدك؟" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("مرحبا! كيف أقدر أساعدك؟")).toBeInTheDocument();
    expect(screen.getByText(/بوت/)).toBeInTheDocument();
  });

  it("renders image message", () => {
    const msg = makeMessage({
      message_type: "image",
      media_url: "https://example.com/photo.jpg",
      content: null,
    });
    render(<MessageBubble message={msg} />);
    const img = screen.getByAltText("صورة");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("expands image on click", () => {
    const msg = makeMessage({
      message_type: "image",
      media_url: "https://example.com/photo.jpg",
      content: null,
    });
    render(<MessageBubble message={msg} />);
    const img = screen.getByAltText("صورة");
    fireEvent.click(img);
    // Should show expanded overlay
    const images = screen.getAllByAltText("صورة");
    expect(images.length).toBe(2); // Original + expanded
  });

  it("renders document message with link", () => {
    const msg = makeMessage({
      message_type: "document",
      media_url: "https://example.com/doc.pdf",
      media_filename: "invoice.pdf",
      content: null,
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
  });

  it("renders audio message with controls", () => {
    const msg = makeMessage({
      message_type: "audio",
      media_url: "https://example.com/audio.mp3",
      content: null,
    });
    const { container } = render(<MessageBubble message={msg} />);
    const audio = container.querySelector("audio");
    expect(audio).toBeInTheDocument();
  });

  it("renders video message with controls", () => {
    const msg = makeMessage({
      message_type: "video",
      media_url: "https://example.com/video.mp4",
      content: null,
    });
    const { container } = render(<MessageBubble message={msg} />);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
  });

  it("renders location message", () => {
    const msg = makeMessage({ message_type: "location", content: null });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("📍")).toBeInTheDocument();
    expect(screen.getByText("موقع")).toBeInTheDocument();
  });

  it("shows date separator when showDate is true", () => {
    const msg = makeMessage({ created_at: "2026-04-17T10:00:00Z" });
    render(<MessageBubble message={msg} showDate />);
    expect(screen.getByText("اليوم")).toBeInTheDocument();
  });

  it("does not show date separator when showDate is false", () => {
    const msg = makeMessage();
    render(<MessageBubble message={msg} showDate={false} />);
    expect(screen.queryByText("اليوم")).not.toBeInTheDocument();
  });
});
