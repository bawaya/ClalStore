// =====================================================
// ClalMobile — Mobile Chat Page (Single Conversation)
// =====================================================

"use client";

import { use } from "react";
import { MobileChat } from "@/components/mobile/MobileChat";

export default function MobileChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MobileChat conversationId={id} />;
}
