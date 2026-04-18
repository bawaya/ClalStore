import { redirect } from "next/navigation";

/**
 * Legacy path — the employee commissions screen now lives inside the unified
 * Sales PWA. Redirect server-side so deep links and bookmarks keep working.
 */
export default function LegacyCommissionsRedirect(): never {
  redirect("/sales-pwa/commissions");
}
