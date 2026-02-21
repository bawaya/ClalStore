import { WebChatWidget } from "@/components/chat/WebChatWidget";
import { CompareBar } from "@/components/store/CompareBar";

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
    </>
  );
}
