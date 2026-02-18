import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "ClalMobile — لوحة الإدارة" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
