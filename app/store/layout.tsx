import { CompareBar } from "@/components/store/CompareBar";

// WebChatWidget is now mounted globally in app/layout.tsx via PublicChrome
// to avoid double-mount on store pages.
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CompareBar />
    </>
  );
}
