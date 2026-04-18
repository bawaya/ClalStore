import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export const metadata = { title: "ClalMobile — بوابة الموظف" };

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <header className="bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/employee/commissions" className="flex items-center gap-2">
          <Logo size={28} showText label="ClalMobile" />
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/employee/commissions"
            className="chip chip-active text-[11px]"
          >
            עמלות / العمولات
          </Link>
        </nav>
      </header>
      <main className="p-3 md:p-5 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
