// =====================================================
// ClalMobile — Payment Gateway Router
// Auto-detects which gateway to use based on customer city
// Israeli cities → Rivhit (iCredit)
// Palestinian / other → UPay
// Uses city list from lib/cities.ts as single source of truth
// =====================================================

import { ISRAEL_CITIES } from "./cities";

const PALESTINIAN_CITIES_AR = new Set([
  "رام الله", "البيرة", "نابلس", "الخليل", "بيت لحم", "جنين", "طولكرم",
  "قلقيلية", "أريحا", "سلفيت", "طوباس", "بيت ساحور", "بيت جالا",
  "العيزرية", "أبو ديس", "الظاهرية", "دورا", "يطا", "حلحول", "سعير",
  "بني نعيم", "ترقوميا", "بيت أولا", "إذنا", "بيت فجار", "تقوع",
  "نحالين", "الدوحة", "عزون", "حبلة", "عنبتا", "بلعا", "قباطية",
  "يعبد", "عرابة فلسطين", "سيلة الحارثية", "عقابا", "تمون",
  "عصيرة الشمالية", "بيت فوريك", "حوارة", "بيتونيا", "بير زيت",
  "سلواد", "بيت لقيا", "بدو", "دير دبوان", "بيت عنان",
  "الزبابدة", "السيلة", "عجة", "الفندقومية", "عتيل", "بيت ليد",
  "شويكة", "كفر اللبد", "ديريستيا", "بروقين", "كفل حارس", "بديا",
  "مسحة", "جماعين", "بيتا", "عقربا", "بلاطة البلد", "عسكر",
  "روجيب", "كفر الديك", "دير غسانة", "بيت ريما",
  "غزة", "خان يونس", "رفح", "دير البلح", "جباليا",
  "بيت حانون", "بيت لاهيا", "النصيرات", "البريج", "المغازي",
]);

const PALESTINIAN_CITIES_HE = new Set([
  "רמאללה", "אל-בירה", "שכם", "חברון", "בית לחם", "ג'נין", "טולכרם",
  "קלקיליה", "יריחו", "סלפית", "טובאס", "בית סאהור", "בית ג'אלה",
  "אל-עיזריה", "אבו דיס", "א-דאהריה", "דורא", "יטא", "חלחול", "סעיר",
  "בני נעים", "תרקומיא", "בית עולא", "אדנא", "בית פג'אר", "תקוע",
  "נחאלין", "א-דוחה", "עזון", "חבלה", "ענבתא", "בלעא", "קבטיה",
  "יעבד", "סילת אל-חארתיה", "עקבה", "טמון",
  "עסירה א-שמאליה", "בית פוריק", "חווארה", "ביתוניא", "ביר זית",
  "סילוואד", "בית ליקיא", "בידו", "דיר דבואן", "בית ענאן",
  "עזה", "חאן יונס", "רפיח", "דיר אל-בלח", "ג'באליא",
  "בית חנון", "בית להיא", "א-נוסייראת", "אל-בורייג'", "אל-מגאזי",
]);

const israeliCitiesAr = new Set<string>();
const israeliCitiesHe = new Set<string>();

for (const city of ISRAEL_CITIES) {
  if (!PALESTINIAN_CITIES_AR.has(city.ar) && !PALESTINIAN_CITIES_HE.has(city.he)) {
    israeliCitiesAr.add(city.ar);
    israeliCitiesHe.add(city.he);
  }
}

export type PaymentGateway = "rivhit" | "upay";

export function detectPaymentGateway(city: string): PaymentGateway {
  if (!city) return "upay";
  const trimmed = city.trim();
  if (israeliCitiesAr.has(trimmed) || israeliCitiesHe.has(trimmed)) {
    return "rivhit";
  }
  return "upay";
}

export function getGatewayDisplayInfo(gateway: PaymentGateway) {
  if (gateway === "rivhit") {
    return {
      name: "iCredit",
      logo: "/icons/icredit-logo.svg",
      securityText: "PCI-DSS Level 1",
      supports: ["Visa", "Mastercard", "Isracard", "Bit", "Apple Pay"],
    };
  }
  return {
    name: "UPay",
    logo: "/icons/upay-logo.svg",
    securityText: "SSL Secured",
    supports: ["Visa", "Mastercard", "PayPal", "Apple Pay", "Google Pay"],
  };
}
