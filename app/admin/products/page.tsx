import { redirect } from "next/navigation";

// /admin/products is preserved as a redirect for bookmarks and old links.
// The phones catalog now lives at /admin/phones; accessories at /admin/accessories.
export default function AdminProductsRedirect() {
  redirect("/admin/phones");
}
