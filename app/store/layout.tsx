import { WebChatWidget } from "@/components/chat/WebChatWidget";
import { CompareBar } from "@/components/store/CompareBar";
import { FloatingActions } from "@/components/store/FloatingActions";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CompareBar />
      <WebChatWidget />
      <FloatingActions />
    </>
  );
}
