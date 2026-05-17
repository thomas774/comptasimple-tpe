import { useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  getListClientsQueryKey,
  useListInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  getListInvoicesQueryKey,
  useListDevis,
  useCreateDevis,
  useUpdateDevis,
  getListDevisQueryKey,
  useListExpenses,
  useCreateExpense,
  getListExpensesQueryKey,
  useListTransactions,
  useBulkCreateTransactions,
  useUpdateTransaction,
  getListTransactionsQueryKey,
  useGetBankAccount,
  useUpsertBankAccount,
  getGetBankAccountQueryKey,
  useGetCompany,
  useUpsertCompany,
  getGetCompanyQueryKey,
} from "@workspace/api-client-react";
import type {
  Client as ApiClient,
  Invoice as ApiInvoice,
  Devis as ApiDevis,
  Expense as ApiExpense,
  Transaction as ApiTransaction,
  Company as ApiCompany,
} from "@workspace/api-client-react";

// ── Frontend type aliases ────────────────────────────────────────────────────

export type ClientRow = {
  _id: number;
  name: string;
  email: string;
  siret: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  legalForm: string;
};

export type InvoiceRow = {
  id: string;
  client: string;
  date: string;
  amountHT: number;
  vatRate: number;
  status: "Brouillon" | "En attente" | "Payée" | "En retard";
};

export type ExpenseRow = {
  id: string;
  supplier: string;
  category: string;
  date: string;
  amountHT: number;
  vatRate: number;
};

export type DevisLineRow = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  vatRate: number;
};

export type DevisRow = {
  id: string;
  client: string;
  subject: string;
  date: string;
  validUntil: string;
  lines: DevisLineRow[];
  notes: string;
  paymentTerms: string;
  status: "Brouillon" | "Envoyé" | "Accepté" | "Refusé" | "Transformé";
};

export type BankTransactionRow = {
  id: string;
  date: string;
  label: string;
  category: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  vatRate: number | null;
  documentName: string | null;
};

export type CompanyRow = {
  name: string;
  legalForm: string;
  siret: string;
  vatNumber: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  logo: string;
};

// ── Adapters ─────────────────────────────────────────────────────────────────

function adaptClient(c: ApiClient): ClientRow {
  return {
    _id: c.id,
    name: c.name ?? "",
    email: c.email ?? "",
    siret: c.siret ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    postalCode: c.postalCode ?? "",
    legalForm: c.legalForm ?? "",
  };
}

function adaptInvoice(i: ApiInvoice): InvoiceRow {
  return {
    id: i.invoiceId,
    client: i.clientName,
    date: i.date,
    amountHT: Number(i.amountHT),
    vatRate: Number(i.vatRate),
    status: i.status as InvoiceRow["status"],
  };
}

function adaptExpense(e: ApiExpense): ExpenseRow {
  return {
    id: e.expenseId,
    supplier: e.supplier,
    category: e.category,
    date: e.date,
    amountHT: Number(e.amountHT),
    vatRate: Number(e.vatRate),
  };
}

function adaptDevis(d: ApiDevis): DevisRow {
  return {
    id: d.devisId,
    client: d.clientName,
    subject: d.subject,
    date: d.date,
    validUntil: d.validUntil,
    lines: (d.lines as DevisLineRow[]) ?? [],
    notes: d.notes ?? "",
    paymentTerms: d.paymentTerms ?? "",
    status: d.status as DevisRow["status"],
  };
}

function adaptTransaction(t: ApiTransaction): BankTransactionRow {
  const amount = Math.abs(Number(t.amount));
  return {
    id: t.txId,
    date: t.date,
    label: t.label,
    category: t.category ?? "Autre",
    debit: t.type === "debit" ? amount : null,
    credit: t.type === "credit" ? amount : null,
    balance: 0,
    vatRate: t.vatRate != null ? Number(t.vatRate) : null,
    documentName: t.documentName ?? null,
  };
}

function adaptCompany(c: ApiCompany | undefined): CompanyRow {
  return {
    name: c?.name ?? "",
    legalForm: c?.legalForm ?? "",
    siret: c?.siret ?? "",
    vatNumber: c?.vatNumber ?? "",
    address: c?.address ?? "",
    postalCode: c?.postalCode ?? "",
    city: c?.city ?? "",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    website: c?.website ?? "",
    iban: c?.iban ?? "",
    logo: c?.logo ?? "",
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useComptaData() {
  const queryClient = useQueryClient();

  // ── Queries ──
  const { data: rawClients = [] } = useListClients();
  const { data: rawInvoices = [] } = useListInvoices();
  const { data: rawExpenses = [] } = useListExpenses();
  const { data: rawDevis = [] } = useListDevis();
  const { data: rawTransactions = [] } = useListTransactions();
  const { data: rawBankAccount } = useGetBankAccount();
  const { data: rawCompany } = useGetCompany();

  // ── Adapted data ──
  const clients = rawClients.map(adaptClient);
  const invoices = rawInvoices.map(adaptInvoice);
  const expenses = rawExpenses.map(adaptExpense);
  const devisList = rawDevis.map(adaptDevis);
  const transactions = rawTransactions.map(adaptTransaction);
  const bankConnected = rawBankAccount?.connected ?? false;
  const bankInfo = {
    name: rawBankAccount?.name ?? "",
    iban: rawBankAccount?.iban ?? "",
  };
  const company = adaptCompany(rawCompany);

  // ── Invalidation helpers ──
  const invalidateClients = () =>
    queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
  const invalidateInvoices = () =>
    queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
  const invalidateExpenses = () =>
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
  const invalidateDevis = () =>
    queryClient.invalidateQueries({ queryKey: getListDevisQueryKey() });
  const invalidateTransactions = () =>
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
  const invalidateBankAccount = () =>
    queryClient.invalidateQueries({ queryKey: getGetBankAccountQueryKey() });
  const invalidateCompany = () =>
    queryClient.invalidateQueries({ queryKey: getGetCompanyQueryKey() });

  // ── Mutations ──
  const createClientMut = useCreateClient();
  const updateClientMut = useUpdateClient();
  const deleteClientMut = useDeleteClient();

  const createInvoiceMut = useCreateInvoice();
  const updateInvoiceMut = useUpdateInvoice();

  const createDevisMut = useCreateDevis();
  const updateDevisMut = useUpdateDevis();

  const createExpenseMut = useCreateExpense();

  const bulkCreateTransactionsMut = useBulkCreateTransactions();
  const updateTransactionMut = useUpdateTransaction();

  const upsertBankAccountMut = useUpsertBankAccount();
  const upsertCompanyMut = useUpsertCompany();

  // ── Mutation functions ──

  function addClient(form: Omit<ClientRow, "_id">, onSuccess?: () => void) {
    createClientMut.mutate(
      { data: { name: form.name, email: form.email, siret: form.siret, phone: form.phone, address: form.address, city: form.city, postalCode: form.postalCode, legalForm: form.legalForm } },
      { onSuccess: () => { invalidateClients(); onSuccess?.(); } }
    );
  }

  function updateClient(clientId: number, form: Omit<ClientRow, "_id">, onSuccess?: () => void) {
    updateClientMut.mutate(
      { id: clientId, data: { name: form.name, email: form.email, siret: form.siret, phone: form.phone, address: form.address, city: form.city, postalCode: form.postalCode, legalForm: form.legalForm } },
      { onSuccess: () => { invalidateClients(); onSuccess?.(); } }
    );
  }

  function deleteClient(clientId: number, onSuccess?: () => void) {
    deleteClientMut.mutate(
      { id: clientId },
      { onSuccess: () => { invalidateClients(); onSuccess?.(); } }
    );
  }

  function addInvoice(data: { invoiceId: string; clientName: string; date: string; amountHT: string; vatRate: string; status?: string }, onSuccess?: () => void) {
    createInvoiceMut.mutate(
      { data },
      { onSuccess: () => { invalidateInvoices(); onSuccess?.(); } }
    );
  }

  function updateInvoiceStatus(invoiceId: string, status: string, onSuccess?: () => void) {
    updateInvoiceMut.mutate(
      { invoiceId, data: { status } },
      { onSuccess: () => { invalidateInvoices(); onSuccess?.(); } }
    );
  }

  function addExpense(data: { expenseId: string; supplier: string; category: string; date: string; amountHT: string; vatRate: string }, onSuccess?: () => void) {
    createExpenseMut.mutate(
      { data },
      { onSuccess: () => { invalidateExpenses(); onSuccess?.(); } }
    );
  }

  function addDevis(data: Parameters<typeof createDevisMut.mutate>[0]["data"], onSuccess?: () => void) {
    createDevisMut.mutate(
      { data },
      { onSuccess: () => { invalidateDevis(); onSuccess?.(); } }
    );
  }

  function updateDevisStatus(devisId: string, status: string, onSuccess?: () => void) {
    updateDevisMut.mutate(
      { devisId, data: { status } },
      { onSuccess: () => { invalidateDevis(); onSuccess?.(); } }
    );
  }

  function updateDevisFull(devisId: string, data: Parameters<typeof updateDevisMut.mutate>[0]["data"], onSuccess?: () => void) {
    updateDevisMut.mutate(
      { devisId, data },
      { onSuccess: () => { invalidateDevis(); onSuccess?.(); } }
    );
  }

  function connectBank(name: string, iban: string, sampleTransactions: Array<{ txId: string; date: string; label: string; amount: string; type: "credit" | "debit"; category: string; vatRate?: string }>, onSuccess?: () => void) {
    upsertBankAccountMut.mutate(
      { data: { name, iban, connected: true } },
      {
        onSuccess: () => {
          invalidateBankAccount();
          if (sampleTransactions.length > 0) {
            bulkCreateTransactionsMut.mutate(
              { data: { transactions: sampleTransactions } },
              { onSuccess: () => { invalidateTransactions(); onSuccess?.(); } }
            );
          } else {
            onSuccess?.();
          }
        },
      }
    );
  }

  function disconnectBank(onSuccess?: () => void) {
    upsertBankAccountMut.mutate(
      { data: { name: "", iban: "", connected: false } },
      {
        onSuccess: () => {
          invalidateBankAccount();
          // Clear all transactions from DB is complex; just mark as disconnected for now
          onSuccess?.();
        },
      }
    );
  }

  function updateTransactionCategory(txId: string, category: string) {
    updateTransactionMut.mutate(
      { txId, data: { category } },
      { onSuccess: () => invalidateTransactions() }
    );
  }

  function updateTransactionVatRate(txId: string, vatRate: string | null) {
    updateTransactionMut.mutate(
      { txId, data: { vatRate: vatRate ?? null } },
      { onSuccess: () => invalidateTransactions() }
    );
  }

  function updateTransactionDocument(txId: string, documentName: string | null) {
    updateTransactionMut.mutate(
      { txId, data: { documentName: documentName ?? null } },
      { onSuccess: () => invalidateTransactions() }
    );
  }

  function saveCompany(data: CompanyRow, onSuccess?: () => void) {
    upsertCompanyMut.mutate(
      { data: { name: data.name, legalForm: data.legalForm, siret: data.siret, vatNumber: data.vatNumber, address: data.address, postalCode: data.postalCode, city: data.city, phone: data.phone, email: data.email, website: data.website, iban: data.iban, logo: data.logo } },
      { onSuccess: () => { invalidateCompany(); onSuccess?.(); } }
    );
  }

  return {
    // data
    clients,
    invoices,
    expenses,
    devisList,
    transactions,
    bankConnected,
    bankInfo,
    company,
    // mutations
    addClient,
    updateClient,
    deleteClient,
    addInvoice,
    updateInvoiceStatus,
    addExpense,
    addDevis,
    updateDevisStatus,
    updateDevisFull,
    connectBank,
    disconnectBank,
    updateTransactionCategory,
    updateTransactionVatRate,
    updateTransactionDocument,
    saveCompany,
    // loading states for bank connect
    isBankConnecting: upsertBankAccountMut.isPending,
  };
}
