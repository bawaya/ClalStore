import { WebChatWidget } from "@/components/chat/WebChatWidget";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <WebChatWidget />
    </>
  );
}
