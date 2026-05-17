const TINK_BASE = "https://api.tink.com";

// ── Token cache for client_credentials ───────────────────────────────────────
interface ClientToken {
  access_token: string;
  expiresAt: number;
}
let cachedClientToken: ClientToken | null = null;

async function getClientToken(scope: string): Promise<string> {
  // Each scope may need its own token; for simplicity re-fetch if scope differs
  if (cachedClientToken && Date.now() < cachedClientToken.expiresAt) {
    return cachedClientToken.access_token;
  }
  const clientId = process.env.TINK_CLIENT_ID;
  const clientSecret = process.env.TINK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TINK_CLIENT_ID et TINK_CLIENT_SECRET ne sont pas configurés");
  }
  const res = await fetch(`${TINK_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tink auth failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedClientToken = {
    access_token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedClientToken.access_token;
}

// ── Build Tink Link URL ───────────────────────────────────────────────────────
// Uses the direct Tink Link URL format (no delegate grant required for unverified apps)
export function buildTinkLinkUrl(
  redirectUri: string,
  market = "FR",
  locale = "fr_FR",
): string {
  const clientId = process.env.TINK_CLIENT_ID;
  if (!clientId) throw new Error("TINK_CLIENT_ID non configuré");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    market,
    locale,
    scope: "accounts:read,transactions:read,balances:read,credentials:read",
    response_type: "code",
  });

  return `https://link.tink.com/1.0/transactions/connect-accounts?${params.toString()}`;
}

// ── Exchange user authorization code for user access token ───────────────────
export async function exchangeCode(code: string): Promise<{ access_token: string }> {
  const clientId = process.env.TINK_CLIENT_ID;
  const clientSecret = process.env.TINK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("TINK_CLIENT_ID et TINK_CLIENT_SECRET ne sont pas configurés");

  const res = await fetch(`${TINK_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tink token exchange failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<{ access_token: string }>;
}

async function tinkFetch(path: string, userToken: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${TINK_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${userToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

// ── Fetch accounts ────────────────────────────────────────────────────────────
export interface TinkAccount {
  id: string;
  name: string;
  type: string;
  identifiers: {
    iban?: { iban: string };
    financialInstitution?: { accountNumber: string };
  };
  balances: {
    booked?: { amount: { value: { unscaledValue: string; scale: string }; currencyCode: string } };
    available?: { amount: { value: { unscaledValue: string; scale: string }; currencyCode: string } };
  };
  financialInstitutionId: string;
}

export async function listAccounts(userToken: string): Promise<TinkAccount[]> {
  const res = await tinkFetch("/data/v2/accounts", userToken);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tink listAccounts failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { accounts: TinkAccount[] };
  return data.accounts ?? [];
}

// ── Fetch transactions ────────────────────────────────────────────────────────
export interface TinkTransaction {
  id: string;
  accountId: string;
  amount: { value: { unscaledValue: string; scale: string }; currencyCode: string };
  dates: { booked?: string; value?: string };
  descriptions: { original?: string; display?: string };
  status: string;
  merchantInformation?: { merchantName?: string };
  reference?: string;
}

export async function listTransactions(
  userToken: string,
  accountId?: string,
  pageToken?: string,
): Promise<{ transactions: TinkTransaction[]; nextPageToken?: string }> {
  const params = new URLSearchParams();
  if (accountId) params.set("accountIdFilter", accountId);
  params.set("pageSize", "100");
  if (pageToken) params.set("pageToken", pageToken);
  const res = await tinkFetch(`/data/v2/transactions?${params.toString()}`, userToken);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tink listTransactions failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { transactions: TinkTransaction[]; nextPageToken?: string };
  return { transactions: data.transactions ?? [], nextPageToken: data.nextPageToken };
}

// ── Amount helper ─────────────────────────────────────────────────────────────
export function tinkAmountToFloat(amount: TinkTransaction["amount"]): number {
  const unscaled = parseInt(amount.value.unscaledValue, 10);
  const scale = parseInt(amount.value.scale, 10);
  return unscaled / Math.pow(10, scale);
}

// ── Config check ──────────────────────────────────────────────────────────────
export function isConfigured(): boolean {
  return !!(process.env.TINK_CLIENT_ID && process.env.TINK_CLIENT_SECRET);
}

// Keep getClientToken accessible for future use
export { getClientToken };
