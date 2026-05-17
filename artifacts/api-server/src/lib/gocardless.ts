const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

interface GcToken {
  access: string;
  refresh: string;
  accessExpiresAt: number;
}

let cachedToken: GcToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.accessExpiresAt) {
    return cachedToken.access;
  }

  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY are not configured");
  }

  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GoCardless auth failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { access: string; refresh: string; access_expires: number };
  cachedToken = {
    access: data.access,
    refresh: data.refresh,
    accessExpiresAt: Date.now() + (data.access_expires - 120) * 1000,
  };

  return cachedToken.access;
}

async function gcFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${GC_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export interface GcInstitution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
  transaction_total_days: string;
}

export async function getInstitutions(country = "fr"): Promise<GcInstitution[]> {
  const res = await gcFetch(`/institutions/?country=${country}`);
  if (!res.ok) throw new Error(`GoCardless institutions failed (${res.status})`);
  return res.json() as Promise<GcInstitution[]>;
}

export interface GcRequisition {
  id: string;
  link: string;
  accounts: string[];
  status: string;
  institution_id: string;
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string,
): Promise<GcRequisition> {
  const res = await gcFetch("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      reference,
      user_language: "FR",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GoCardless requisition failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<GcRequisition>;
}

export async function getRequisition(requisitionId: string): Promise<GcRequisition> {
  const res = await gcFetch(`/requisitions/${requisitionId}/`);
  if (!res.ok) throw new Error(`GoCardless getRequisition failed (${res.status})`);
  return res.json() as Promise<GcRequisition>;
}

export interface GcAccountDetails {
  iban: string;
  name: string;
  ownerName: string;
  currency: string;
}

export async function getAccountDetails(accountId: string): Promise<GcAccountDetails> {
  const res = await gcFetch(`/accounts/${accountId}/details/`);
  if (!res.ok) throw new Error(`GoCardless account details failed (${res.status})`);
  const data = await res.json() as { account: GcAccountDetails };
  return data.account;
}

export interface GcBalance {
  balanceAmount: { amount: string; currency: string };
  balanceType: string;
}

export async function getAccountBalances(accountId: string): Promise<GcBalance[]> {
  const res = await gcFetch(`/accounts/${accountId}/balances/`);
  if (!res.ok) throw new Error(`GoCardless balances failed (${res.status})`);
  const data = await res.json() as { balances: GcBalance[] };
  return data.balances;
}

export interface GcTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { iban?: string };
  debtorAccount?: { iban?: string };
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
): Promise<{ booked: GcTransaction[]; pending: GcTransaction[] }> {
  const params = dateFrom ? `?date_from=${dateFrom}` : "";
  const res = await gcFetch(`/accounts/${accountId}/transactions/${params}`);
  if (!res.ok) throw new Error(`GoCardless transactions failed (${res.status})`);
  const data = await res.json() as { transactions: { booked: GcTransaction[]; pending: GcTransaction[] } };
  return data.transactions;
}

export async function deleteRequisition(requisitionId: string): Promise<void> {
  const res = await gcFetch(`/requisitions/${requisitionId}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`GoCardless delete requisition failed (${res.status})`);
  }
}

export function isConfigured(): boolean {
  return !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY);
}
