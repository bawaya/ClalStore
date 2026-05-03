export default function PaymentPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#070709] text-white py-12 sm:py-24 px-4 max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-medium mb-4">كيف ندفع؟</h1>
      <p className="text-white/70 leading-loose mb-8">
        تقسيط حتى 18 دفعة بسعر الكاش، بدون أي فائدة، وبدون حجز سقف بطاقة الائتمان (מסגרת כרטיסי אשראי).
        أو حتى 36 دفعة بتمويل بنكي مريح.
      </p>
      <p className="text-white/50 text-sm">
        الصفحة قيد التطوير. للاستفسارات:{" "}
        <a href="https://wa.me/972533337653" className="text-[#ff0e34] hover:underline">واتساب</a>
        {" "}أو{" "}
        <a href="tel:0533337653" className="text-[#ff0e34] hover:underline">053-3337653</a>.
      </p>
    </div>
  );
}
