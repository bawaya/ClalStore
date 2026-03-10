export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMCustomers, getCustomerOrders } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    if (customerId) {
      const orders = await getCustomerOrders(customerId);
      return NextResponse.json({ orders });
    }
    const filters = {
      segment: searchParams.get("segment") || undefined,
      search: searchParams.get("search") || undefined,
    };
    const data = await getCRMCustomers(filters);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
