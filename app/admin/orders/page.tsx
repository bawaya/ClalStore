"use client";

export const dynamic = "force-dynamic";

import { OrdersManagementPage } from "@/components/crm/OrdersManagementPage";

export default function AdminOrdersPage() {
  return <OrdersManagementPage title="إدارة الطلبات" titleIcon="🧾" />;
}
