// =====================================================
// ClalMobile — Inbox Layout (3-column responsive)
// =====================================================

"use client";

import { useState, useCallback } from "react";
import { useScreen } from "@/lib/hooks";
import { useInboxMessages, fetchTemplates } from "@/lib/crm/inbox";
import type { InboxConversation } from "@/lib/crm/inbox-types";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { ContactPanel } from "./ContactPanel";

type MobileView = "list" | "chat" | "contact";

export function InboxLayout() {
  const { mobile, tablet } = useScreen();
  const [selectedConv, setSelectedConv] = useState<InboxConversation | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");

  /* Fetch messages for selected conversation */
  const { detail, loading: messagesLoading, refresh: refreshMessages } = useInboxMessages(
    selectedConv?.id || null
  );

  /* Select a conversation */
  const handleSelect = useCallback(
    (conv: InboxConversation) => {
      setSelectedConv(conv);
      if (mobile) {
        setMobileView("chat");
      }
    },
    [mobile]
  );

  /* Go back to list (mobile) */
  const handleBack = useCallback(() => {
    setMobileView("list");
    setSelectedConv(null);
  }, []);

  /* Toggle contact panel */
  const handleToggleContact = useCallback(() => {
    if (mobile) {
      setMobileView("contact");
    } else {
      setShowContact((prev) => !prev);
    }
  }, [mobile]);

  /* Close contact panel */
  const handleCloseContact = useCallback(() => {
    if (mobile) {
      setMobileView("chat");
    } else {
      setShowContact(false);
    }
  }, [mobile]);

  const conversation = detail?.conversation || selectedConv;
  const messages = detail?.messages || [];
  const customer = detail?.customer || null;
  const labels = detail?.labels || [];
  const notes = detail?.notes || [];

  /* ──────────── Mobile layout (single view) ──────────── */
  if (mobile) {
    if (mobileView === "contact" && conversation) {
      return (
        <div className="h-full">
          <ContactPanel
            conversation={conversation}
            customer={customer}
            labels={labels}
            notes={notes}
            onRefresh={refreshMessages}
            onClose={handleCloseContact}
          />
        </div>
      );
    }

    if (mobileView === "chat" && conversation) {
      return (
        <div className="h-full">
          <ChatPanel
            conversation={conversation}
            messages={messages}
            onRefresh={refreshMessages}
            onToggleContact={handleToggleContact}
            onBack={handleBack}
          />
        </div>
      );
    }

    return (
      <div className="h-full">
        <ConversationList
          selectedId={selectedConv?.id || null}
          onSelect={handleSelect}
        />
      </div>
    );
  }

  /* ──────────── Tablet layout (2 columns) ──────────── */
  if (tablet) {
    return (
      <div className="flex h-full">
        {/* List — 320px */}
        <div className="w-80 flex-shrink-0 h-full">
          <ConversationList
            selectedId={selectedConv?.id || null}
            onSelect={handleSelect}
          />
        </div>

        {/* Chat or placeholder */}
        <div className="flex-1 h-full">
          {conversation ? (
            <div className="flex h-full">
              <div className={showContact ? "flex-1" : "w-full"}>
                <ChatPanel
                  conversation={conversation}
                  messages={messages}
                  onRefresh={refreshMessages}
                  onToggleContact={handleToggleContact}
                />
              </div>
              {showContact && (
                <div className="w-72 flex-shrink-0 h-full">
                  <ContactPanel
                    conversation={conversation}
                    customer={customer}
                    labels={labels}
                    notes={notes}
                    onRefresh={refreshMessages}
                    onClose={handleCloseContact}
                  />
                </div>
              )}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    );
  }

  /* ──────────── Desktop layout (3 columns) ──────────── */
  return (
    <div className="flex h-full">
      {/* List — 340px */}
      <div className="w-[340px] flex-shrink-0 h-full">
        <ConversationList
          selectedId={selectedConv?.id || null}
          onSelect={handleSelect}
        />
      </div>

      {/* Chat — flexible */}
      <div className="flex-1 h-full">
        {conversation ? (
          <ChatPanel
            conversation={conversation}
            messages={messages}
            onRefresh={refreshMessages}
            onToggleContact={handleToggleContact}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Contact panel — 300px (toggleable) */}
      {showContact && conversation && (
        <div className="w-[300px] flex-shrink-0 h-full">
          <ContactPanel
            conversation={conversation}
            customer={customer}
            labels={labels}
            notes={notes}
            onRefresh={refreshMessages}
            onClose={handleCloseContact}
          />
        </div>
      )}
    </div>
  );
}

/* Empty chat state */
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full bg-surface-bg">
      <div className="text-center">
        <div className="text-6xl mb-4">💬</div>
        <p className="text-lg text-white font-medium mb-1">صندوق الوارد</p>
        <p className="text-sm text-muted">اختر محادثة للبدء</p>
      </div>
    </div>
  );
}
