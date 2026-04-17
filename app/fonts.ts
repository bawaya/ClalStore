import { David_Libre, Heebo, Tajawal } from "next/font/google";

export const fontHeebo = Heebo({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-heebo",
  display: "swap",
});

export const fontTajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

export const fontDavidLibre = David_Libre({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "700"],
  variable: "--font-david-libre",
  display: "swap",
});

/** Apply on <html> so CSS / Tailwind can use var(--font-*) */
export const fontVariables = `${fontHeebo.variable} ${fontTajawal.variable} ${fontDavidLibre.variable}`;
