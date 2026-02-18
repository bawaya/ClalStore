import Link from "next/link";

export default function NotFound() {
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen flex items-center justify-center">
      <div className="text-center px-4">
        <div className="text-7xl mb-4">🔍</div>
        <h1 className="text-4xl font-black mb-2">404</h1>
        <h2 className="text-xl font-bold text-muted mb-4">الصفحة غير موجودة</h2>
        <p className="text-muted mb-6">يبدو أن الصفحة اللي تبحث عنها مش موجودة أو تم نقلها.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/store" className="btn-primary">🛒 المتجر</Link>
          <Link href="/" className="btn-outline">🏠 الرئيسية</Link>
        </div>
      </div>
    </div>
  );
}
