export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMCustomers, getCustomerOrders } from "@/lib/crm/queries";

export async function GET(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
