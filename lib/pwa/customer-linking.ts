export type SalesDocCustomerSummary = {
  id: string;
  name: string;
  phone: string;
  customer_code?: string | null;
};

type SalesDocWithCustomerId = {
  customer_id?: string | null;
};

export function buildCustomerPhoneCandidates(phone: string): string[] {
  const trimmed = phone.trim();
  if (!trimmed) return [];

  const digitsOnly = trimmed.replace(/[^\d+]/g, "");
  const normalized = digitsOnly.startsWith("+") ? digitsOnly.slice(1) : digitsOnly;
  const compact = normalized.replace(/\D/g, "");

  const candidates = new Set<string>();

  if (trimmed) candidates.add(trimmed);
  if (normalized) candidates.add(normalized);
  if (compact) candidates.add(compact);

  if (compact.startsWith("972") && compact.length >= 12) {
    candidates.add(`0${compact.slice(3)}`);
    candidates.add(`+${compact}`);
  }

  if (compact.startsWith("0") && compact.length >= 10) {
    candidates.add(`972${compact.slice(1)}`);
    candidates.add(`+972${compact.slice(1)}`);
  }

  return [...candidates].filter(Boolean);
}

export function extractCustomerIdsFromSalesDocs<T extends SalesDocWithCustomerId>(docs: T[]): string[] {
  return [...new Set(docs.map((doc) => doc.customer_id).filter(Boolean))] as string[];
}

export function attachCustomersToSalesDocs<T extends SalesDocWithCustomerId & Record<string, unknown>>(
  docs: T[],
  customers: SalesDocCustomerSummary[],
): Array<T & { customer: SalesDocCustomerSummary | null }> {
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

  return docs.map((doc) => ({
    ...doc,
    customer: doc.customer_id ? customerMap.get(doc.customer_id) ?? null : null,
  }));
}