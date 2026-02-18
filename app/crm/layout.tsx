import { CRMShell } from "@/components/crm/CRMShell";
export const metadata = { title: "ClalMobile — CRM" };
export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return <CRMShell>{children}</CRMShell>;
}
