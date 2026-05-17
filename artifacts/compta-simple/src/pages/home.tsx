import { useState, useMemo, useRef, useEffect } from "react";
import { useComptaData } from "@/hooks/useComptaData";
import FiscalCalendar from "./fiscal-calendar";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Building2, FileText, Receipt, Euro, Plus, Download, Search, FileDown, UserPlus, Mail, Phone, MapPin, Hash, Briefcase, Pencil, Trash2, AlertTriangle, Landmark, Link2, TrendingUp, TrendingDown, RefreshCw, Unlink, CreditCard, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, BarChart2, PieChart as PieChartIcon, FileBarChart, ClipboardList, Calculator, CheckCircle2, AlertCircle, FileSignature, Send, ArrowRightCircle, Clock, Settings, Globe, CreditCard as IBANIcon, Save, Building, Scale, ExternalLink, ChevronRight, Info, Paperclip, X, ScanLine, Camera, Sparkles, LogOut, User, ImageIcon, Upload, CalendarDays } from "lucide-react";
import { useClerk, useUser, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


const emptyClientForm = { name: "", email: "", siret: "", phone: "", address: "", city: "", postalCode: "", legalForm: "" };

type CompanyInfo = {
  name: string; legalForm: string; siret: string; vatNumber: string;
  address: string; postalCode: string; city: string;
  phone: string; email: string; website: string; iban: string; logo: string;
};

const defaultCompany: CompanyInfo = {
  name: "Mon Entreprise", legalForm: "SAS", siret: "", vatNumber: "",
  address: "", postalCode: "", city: "",
  phone: "", email: "", website: "", iban: "", logo: "",
};

async function resizeLogoToBase64(file: File, maxW = 400, maxH = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

type DevisLine = {
  id: string; description: string; quantity: number; unitPrice: number; unit: string; vatRate: number;
};

type Devis = {
  id: string; client: string; subject: string; date: string; validUntil: string;
  lines: DevisLine[]; notes: string; paymentTerms: string;
  status: "Brouillon" | "Envoyé" | "Accepté" | "Refusé" | "Transformé";
};

const newDevisLine = (): DevisLine => ({
  id: Math.random().toString(36).slice(2),
  description: "", quantity: 1, unitPrice: 0, unit: "forfait", vatRate: 20,
});

function devisAmountHT(d: Devis): number {
  return d.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
}
function devisVAT(d: Devis): number {
  return d.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100), 0);
}
function devisPrimaryVatRate(d: Devis): number {
  return d.lines[0]?.vatRate ?? 20;
}


const TRANSACTION_CATEGORIES = [
  "Recette", "Frais généraux", "Télécom", "Matériel", "Logiciels",
  "Loyer", "Énergie", "Assurance", "Véhicule", "Frais bancaires",
  "Charges sociales", "TVA", "Impôts & taxes", "Publicité", "Déplacements",
  "Restauration", "Sous-traitance", "Fournitures", "Formation", "Autre",
];

const FRENCH_BANKS = [
  "BNP Paribas", "Crédit Agricole", "Société Générale", "LCL", "CIC",
  "La Banque Postale", "Boursorama Banque", "Qonto", "Crédit Mutuel", "HSBC France",
];

// Popular banks to show as quick-access tiles (matched against GoCardless institution names)
const POPULAR_BANK_NAMES = [
  "BNP Paribas", "Crédit Agricole", "Société Générale", "LCL", "CIC",
  "Crédit Mutuel", "Boursorama", "Qonto", "Revolut", "N26", "Banque Postale", "HSBC",
];

type BankTransaction = {
  id: string; date: string; label: string; category: string;
  debit: number | null; credit: number | null; balance: number;
  vatRate: number | null; documentName: string | null;
};

const SAMPLE_TRANSACTIONS: BankTransaction[] = [
  { id: "T001", date: "2026-05-12", label: "Virement client GARAGE MARTIN", category: "Recette", debit: null, credit: 1020.00, balance: 14_320.00, vatRate: null, documentName: null },
  { id: "T002", date: "2026-05-10", label: "ORANGE BUSINESS SERVICES", category: "Télécom", debit: 58.80, credit: null, balance: 13_300.00, vatRate: 20, documentName: null },
  { id: "T003", date: "2026-05-09", label: "AMAZON BUSINESS FR", category: "Matériel", debit: 252.00, credit: null, balance: 13_358.80, vatRate: 20, documentName: null },
  { id: "T004", date: "2026-05-07", label: "Prélèvement URSSAF", category: "Charges sociales", debit: 843.00, credit: null, balance: 13_610.80, vatRate: 0, documentName: null },
  { id: "T005", date: "2026-05-06", label: "Virement client BOULANGERIE DURAND", category: "Recette", debit: null, credit: 1500.00, balance: 14_453.80, vatRate: null, documentName: null },
  { id: "T006", date: "2026-05-05", label: "EDF ENTREPRISES", category: "Énergie", debit: 187.20, credit: null, balance: 12_953.80, vatRate: 20, documentName: null },
  { id: "T007", date: "2026-05-03", label: "FRAIS TENUE COMPTE MAI", category: "Frais bancaires", debit: 21.60, credit: null, balance: 13_141.00, vatRate: 0, documentName: null },
  { id: "T008", date: "2026-05-02", label: "Loyer local professionnel", category: "Loyer", debit: 1_200.00, credit: null, balance: 13_162.60, vatRate: 20, documentName: null },
  { id: "T009", date: "2026-05-01", label: "Prélèvement TVA DGFiP", category: "TVA", debit: 364.60, credit: null, balance: 14_362.60, vatRate: null, documentName: null },
  { id: "T010", date: "2026-04-28", label: "Virement client SAS NOVA", category: "Recette", debit: null, credit: 420.00, balance: 14_727.20, vatRate: null, documentName: null },
  { id: "T011", date: "2026-04-25", label: "Assurance MMA PRO", category: "Assurance", debit: 98.00, credit: null, balance: 14_307.20, vatRate: 20, documentName: null },
  { id: "T012", date: "2026-04-22", label: "CARBURANT TOTAL ACCESS", category: "Véhicule", debit: 74.50, credit: null, balance: 14_405.20, vatRate: 20, documentName: null },
  { id: "T013", date: "2026-04-20", label: "Achat logiciel ADOBE", category: "Logiciels", debit: 54.99, credit: null, balance: 14_479.70, vatRate: 20, documentName: null },
  { id: "T014", date: "2026-04-15", label: "Virement GARAGE MARTIN acompte", category: "Recette", debit: null, credit: 500.00, balance: 14_534.69, vatRate: null, documentName: null },
  { id: "T015", date: "2026-04-10", label: "Remboursement note de frais", category: "Frais généraux", debit: 120.00, credit: null, balance: 14_034.69, vatRate: 0, documentName: null },
];

function money(value: number | string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
}

function vat(amountHT: number, vatRate: number) {
  return amountHT * (vatRate / 100);
}

function StatCard({ icon: Icon, title, value, subtitle }: { icon: any, title: string, value: string, subtitle: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10 text-primary">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HeaderUserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (!isLoaded) return null;

  const displayName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "Mon compte";
  const initials = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <span className="text-sm text-slate-700 font-medium hidden sm:block max-w-[140px] truncate">{displayName}</span>
      </div>
      <button
        onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100"
        title="Se déconnecter"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:block">Déconnexion</span>
      </button>
    </div>
  );
}

export default function Home() {
  const {
    clients, invoices, expenses, devisList, transactions,
    bankConnected, bankInfo, company,
    addClient: addClientApi, updateClient: updateClientApi, deleteClient: deleteClientApi,
    addInvoice: addInvoiceApi, updateInvoiceStatus,
    addExpense: addExpenseApi,
    addDevis: addDevisApi, updateDevisStatus, updateDevisFull,
    updateTransactionCategory: updateTxCategory,
    updateTransactionVatRate: updateTxVatRate,
    updateTransactionDocument,
    saveCompany: saveCompanyApi,
    isBankConnecting,
  } = useComptaData();

  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [newInvoice, setNewInvoice] = useState({ client: "", amountHT: "", vatRate: "20" });
  const [newExpense, setNewExpense] = useState({ supplier: "", category: "", amountHT: "", vatRate: "20" });
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientForm, setNewClientForm] = useState(emptyClientForm);
  const [clientFormError, setClientFormError] = useState("");
  const [editingClientIndex, setEditingClientIndex] = useState<number | null>(null);
  const [editingClientDbId, setEditingClientDbId] = useState<number | null>(null);
  const [deleteClientIndex, setDeleteClientIndex] = useState<number | null>(null);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [bankForm, setBankForm] = useState({ name: "", iban: "" });
  const [bankFormError, setBankFormError] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [devisSearch, setDevisSearch] = useState("");
  const [showDevisDialog, setShowDevisDialog] = useState(false);
  const [devisFormState, setDevisFormState] = useState<{
    client: string; subject: string; validityDays: string; notes: string; paymentTerms: string; lines: DevisLine[];
  }>({ client: "", subject: "", validityDays: "30", notes: "", paymentTerms: "Paiement à 30 jours", lines: [newDevisLine()] });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [companyForm, setCompanyForm] = useState<CompanyInfo>(defaultCompany);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocTxId, setPendingDocTxId] = useState<string | null>(null);
  const [ocrLoadingTxId, setOcrLoadingTxId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{ txId: string; vatRate: number | null; supplier: string | null; category: string | null; amountHT: number | null } | null>(null);

  // Tink bank connection state
  const [gcConnecting, setGcConnecting] = useState(false);
  const [gcSyncing, setGcSyncing] = useState(false);
  const [gcError, setGcError] = useState<string | null>(null);
  const [gcConfigured, setGcConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (company.name || company.email || company.siret) {
      setCompanyForm(company as CompanyInfo);
    }
  }, [company.name]);

  const updateTransactionCategory = (id: string, category: string) => {
    updateTxCategory(id, category);
  };

  const updateTransactionVatRate = (id: string, rate: number | null) => {
    updateTxVatRate(id, rate !== null ? String(rate) : null);
  };

  const attachDocument = (id: string) => {
    setPendingDocTxId(id);
    fileInputRef.current?.click();
  };

  const removeDocument = (id: string) => {
    updateTransactionDocument(id, null);
  };

  const runOcr = async (file: File, txId: string) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) return;
    setOcrLoadingTxId(txId);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const resp = await authedFetch("/api/ocr/receipt", {
        method: "POST",
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      });
      if (!resp.ok) return;
      const data = await resp.json() as { vatRate: number | null; supplier: string | null; category: string | null; amountHT: number | null };
      if (data.vatRate !== null) {
        updateTxVatRate(txId, String(data.vatRate));
      }
      if (data.category && TRANSACTION_CATEGORIES.includes(data.category)) {
        updateTxCategory(txId, data.category);
      }
      setOcrResult({ txId, vatRate: data.vatRate, supplier: data.supplier, category: data.category, amountHT: data.amountHT });
      setTimeout(() => setOcrResult(null), 6000);
    } catch {
      // silently ignore OCR errors
    } finally {
      setOcrLoadingTxId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingDocTxId) {
      updateTransactionDocument(pendingDocTxId, file.name);
      runOcr(file, pendingDocTxId);
    }
    setPendingDocTxId(null);
    e.target.value = "";
  };

  const saveCompany = () => {
    saveCompanyApi(companyForm as CompanyInfo, () => {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    });
  };

  // ── Authenticated fetch helper (adds Bearer token to every request) ─────────
  const authedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    const existingHeaders = (options.headers ?? {}) as Record<string, string>;
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...existingHeaders,
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
    });
  };

  // ── Tink bank connection functions ──────────────────────────────────────────
  const tinkStartAuth = async () => {
    setGcConnecting(true);
    setGcError(null);
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const res = await authedFetch(`/api/tink/link?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (res.status === 503) { setGcConfigured(false); setGcConnecting(false); return; }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setGcError(data.error ?? "Erreur lors de l'initialisation Tink");
        setGcConnecting(false);
        return;
      }
      setGcConfigured(true);
      const { url } = await res.json() as { url: string };

      // Open Tink Link in a popup to bypass iframe embed restriction.
      // After auth, the popup lands back on this app with ?code=, calls sync,
      // posts a message to this window, then closes itself.
      const pw = 620, ph = 720;
      const pl = window.screenX + Math.round((window.outerWidth - pw) / 2);
      const pt = window.screenY + Math.round((window.outerHeight - ph) / 2);
      const popup = window.open(url, "tink_auth", `width=${pw},height=${ph},left=${pl},top=${pt},noopener=no`);

      if (!popup) {
        // Popup blocked — fallback to same-tab navigation
        window.location.href = url;
        return;
      }

      // Listen for sync result posted back from the popup
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if ((e.data as { type?: string })?.type !== "tink_sync_done") return;
        window.removeEventListener("message", onMessage);
        setGcConnecting(false);
        const msg = e.data as { type: string; error?: string };
        if (msg.error) setGcError(msg.error);
        else queryClient.invalidateQueries();
      };
      window.addEventListener("message", onMessage);
      // Don't reset gcConnecting here — keep spinner until postMessage arrives
    } catch (err) {
      setGcError(err instanceof Error ? err.message : "Erreur réseau");
      setGcConnecting(false);
    }
  };

  const gcRefresh = async () => {
    // Tink tokens are short-lived — user must re-authenticate to refresh
    setActiveTab("bank");
    setGcError("Pour actualiser vos transactions, veuillez reconnecter votre banque.");
  };

  const gcDisconnect = async () => {
    try {
      await authedFetch("/api/tink/connection", { method: "DELETE" });
    } catch { /* ignore */ }
    queryClient.invalidateQueries();
  };

  // Tink redirect callback: returns with ?code=... after bank auth.
  // Works in two modes:
  //   - popup mode  (window.opener set): sync → postMessage to opener → close popup
  //   - direct mode (no opener)        : sync → update local state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    // Clean the URL immediately
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("code");
    cleanUrl.searchParams.delete("state");
    cleanUrl.searchParams.delete("credentials_id");
    window.history.replaceState({}, "", cleanUrl.toString());

    const isPopup = !!window.opener;
    if (!isPopup) {
      setActiveTab("bank");
      setGcSyncing(true);
    }

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/tink/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
          body: JSON.stringify({ code }),
        });
        const data = await res.json() as { error?: string };
        if (isPopup) {
          // Notify parent window then close this popup
          (window.opener as Window).postMessage(
            { type: "tink_sync_done", error: data.error ?? null },
            window.location.origin,
          );
          window.close();
        } else {
          if (data.error) setGcError(data.error);
          else queryClient.invalidateQueries();
          setGcSyncing(false);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : "Erreur de synchronisation";
        if (isPopup) {
          (window.opener as Window).postMessage(
            { type: "tink_sync_done", error },
            window.location.origin,
          );
          window.close();
        } else {
          setGcError(error);
          setGcSyncing(false);
        }
      }
    })();
  }, []);

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, aiLoading]);

  const sendAiMessage = async (content: string) => {
    if (!content.trim() || aiLoading) return;
    const userMsg = { role: "user" as const, content: content.trim() };
    const nextMessages = [...aiMessages, userMsg];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);

    const context = {
      company: { name: company.name, siret: company.siret, vatNumber: company.vatNumber, legalForm: company.legalForm },
      summary: {
        caHT: totals.revenueHT,
        achatsHT: totals.expenseHT,
        tvaDue: totals.vatDue,
        invoiceCount: invoices.length,
        expenseCount: expenses.length,
        clientCount: clients.length,
        currentYear: new Date().getFullYear(),
      },
    };

    let assistantContent = "";
    setAiMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const resp = await authedFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: nextMessages, context }),
      });
      if (!resp.ok || !resp.body) throw new Error("Erreur serveur");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
            if (parsed.error) {
              assistantContent = parsed.error;
            } else if (parsed.content) {
              assistantContent += parsed.content;
              setAiMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "assistant", content: assistantContent },
              ]);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      setAiMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Désolé, une erreur est survenue. Veuillez réessayer." },
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => aiInputRef.current?.focus(), 50);
    }
  };

  const totals = useMemo(() => {
    const revenueHT = invoices.reduce((s, i) => s + Number(i.amountHT), 0);
    const collectedVAT = invoices.reduce((s, i) => s + vat(Number(i.amountHT), Number(i.vatRate)), 0);
    const expenseHT = expenses.reduce((s, e) => s + Number(e.amountHT), 0);
    const deductibleVAT = expenses.reduce((s, e) => s + vat(Number(e.amountHT), Number(e.vatRate)), 0);
    return {
      revenueHT,
      collectedVAT,
      expenseHT,
      deductibleVAT,
      vatDue: collectedVAT - deductibleVAT,
      result: revenueHT - expenseHT,
    };
  }, [invoices, expenses]);

  const chartData = [
    { name: "CA HT", value: totals.revenueHT },
    { name: "Achats HT", value: totals.expenseHT },
    { name: "Résultat", value: totals.result },
    { name: "TVA due", value: totals.vatDue },
  ];

  const filteredInvoices = invoices.filter((i) =>
    `${i.id} ${i.client} ${i.status}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDevis = devisList.filter((d) =>
    `${d.id} ${d.client} ${d.subject} ${d.status}`.toLowerCase().includes(devisSearch.toLowerCase())
  );

  const updateDevisLine = (idx: number, field: keyof DevisLine, value: string | number) => {
    setDevisFormState((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => i === idx ? { ...l, [field]: value } : l),
    }));
  };

  const removeDevisLine = (idx: number) => {
    setDevisFormState((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  const saveDevisForm = () => {
    if (!devisFormState.client || !devisFormState.subject) return;
    const today = new Date();
    const validUntil = new Date(today);
    validUntil.setDate(validUntil.getDate() + Number(devisFormState.validityDays));
    const fmt = (dt: Date) => dt.toISOString().split("T")[0];
    const nextId = `DEV-${today.getFullYear()}-${String(devisList.length + 1).padStart(3, "0")}`;
    const validLines = devisFormState.lines.filter((l) => l.description.trim() || l.unitPrice > 0);
    addDevisApi({
      devisId: nextId,
      clientName: devisFormState.client,
      subject: devisFormState.subject,
      date: fmt(today),
      validUntil: fmt(validUntil),
      lines: validLines.length > 0 ? validLines : devisFormState.lines,
      notes: devisFormState.notes,
      paymentTerms: devisFormState.paymentTerms,
      status: "Brouillon",
    }, () => {
      setShowDevisDialog(false);
      setDevisFormState({ client: "", subject: "", validityDays: "30", notes: "", paymentTerms: "Paiement à 30 jours", lines: [newDevisLine()] });
    });
  };

  const convertToInvoice = (d: Devis) => {
    const today = new Date().toISOString().split("T")[0];
    const nextId = `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, "0")}`;
    addInvoiceApi({
      invoiceId: nextId,
      clientName: d.client,
      date: today,
      amountHT: String(devisAmountHT(d)),
      vatRate: String(devisPrimaryVatRate(d)),
      status: "En attente",
    });
    updateDevisStatus(d.id, "Transformé");
    setActiveTab("invoices");
  };

  const downloadDevisPDF = (d: Devis) => {
    const doc = new jsPDF();
    const totalHT = devisAmountHT(d);
    const totalTVA = devisVAT(d);
    const totalTTC = totalHT + totalTVA;

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 44, "F");
    doc.setTextColor(255, 255, 255);
    const devisTextX = company.logo ? 52 : 14;
    if (company.logo) {
      try { doc.addImage(company.logo, "PNG", 13, 3, 34, 22); } catch { /* ignore */ }
    }
    doc.setFontSize(22); doc.setFont("helvetica", "bold");
    doc.text(company.name, devisTextX, 16);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text([company.legalForm, company.siret ? `SIRET ${company.siret}` : "", company.address, company.city].filter(Boolean).join("  ·  "), devisTextX, 24);
    if (company.email || company.phone) doc.text([company.email, company.phone].filter(Boolean).join("  ·  "), devisTextX, 31);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("DEVIS", 196, 15, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`N° ${d.id}`, 196, 23, { align: "right" });
    doc.text(`Émis le ${d.date}`, 196, 30, { align: "right" });
    doc.text(`Valable jusqu'au ${d.validUntil}`, 196, 37, { align: "right" });
    doc.setTextColor(30, 30, 30);

    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(`Objet : ${d.subject}`, 14, 54);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(120, 48, 76, 22, 2, 2, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("DESTINATAIRE", 128, 54);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(d.client, 128, 62);
    doc.setTextColor(30, 30, 30);

    let y = 78;
    doc.setFillColor(30, 64, 175);
    doc.rect(14, y, 182, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("Description", 18, y + 5.5);
    doc.text("Qté", 102, y + 5.5, { align: "right" });
    doc.text("Unité", 118, y + 5.5, { align: "right" });
    doc.text("PU HT", 146, y + 5.5, { align: "right" });
    doc.text("TVA", 163, y + 5.5, { align: "right" });
    doc.text("Total HT", 196, y + 5.5, { align: "right" });
    y += 10;

    doc.setTextColor(30, 30, 30);
    d.lines.forEach((line, i) => {
      const lineHT = line.quantity * line.unitPrice;
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 3, 182, 9, "F");
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      doc.text(line.description || "–", 18, y + 3, { maxWidth: 76 });
      doc.text(String(line.quantity), 102, y + 3, { align: "right" });
      doc.text(line.unit, 118, y + 3, { align: "right" });
      doc.text(money(line.unitPrice), 146, y + 3, { align: "right" });
      doc.text(`${line.vatRate}%`, 163, y + 3, { align: "right" });
      doc.text(money(lineHT), 196, y + 3, { align: "right" });
      y += 10;
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);
    y += 8;

    const vatByRate = d.lines.reduce<Record<string, { base: number; tva: number }>>((acc, l) => {
      const k = String(l.vatRate);
      if (!acc[k]) acc[k] = { base: 0, tva: 0 };
      acc[k].base += l.quantity * l.unitPrice;
      acc[k].tva += l.quantity * l.unitPrice * (l.vatRate / 100);
      return acc;
    }, {});

    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Total HT", 155, y, { align: "right" });
    doc.setTextColor(30, 30, 30);
    doc.text(money(totalHT), 196, y, { align: "right" });
    y += 8;

    Object.entries(vatByRate).forEach(([rate, v]) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`TVA ${rate}%`, 155, y, { align: "right" });
      doc.setTextColor(30, 30, 30);
      doc.text(money(v.tva), 196, y, { align: "right" });
      y += 8;
    });

    doc.setFillColor(30, 64, 175);
    doc.rect(120, y - 4, 76, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("TOTAL TTC", 155, y + 3, { align: "right" });
    doc.text(money(totalTTC), 196, y + 3, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 18;

    if (d.paymentTerms || d.notes) {
      doc.setFontSize(8.5);
      if (d.paymentTerms) {
        doc.setFont("helvetica", "bold"); doc.text("Conditions de paiement :", 14, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.text(d.paymentTerms, 14, y); y += 8;
      }
      if (d.notes) {
        doc.setFont("helvetica", "bold"); doc.text("Notes :", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        const noteLines = doc.splitTextToSize(d.notes, 180);
        doc.text(noteLines, 14, y); y += noteLines.length * 5 + 5;
      }
    }

    const by = Math.max(y + 10, 248);
    doc.setDrawColor(30, 64, 175); doc.setLineWidth(0.5);
    doc.line(14, by, 196, by); doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
    doc.text("BON POUR ACCORD", 14, by + 8);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, by + 20, 95, by + 20);
    doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150); doc.setFontSize(8);
    doc.text("Signature et cachet du client", 14, by + 26);
    doc.text("Date : _______________", 120, by + 20);
    doc.setFontSize(7.5);
    doc.text(`${company.name} — Devis ${d.id} valable jusqu'au ${d.validUntil}.`, 105, 290, { align: "center" });

    doc.save(`devis-${d.id}.pdf`);
  };

  const addInvoice = () => {
    if (!newInvoice.client || !newInvoice.amountHT) return;
    const id = `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, "0")}`;
    addInvoiceApi({
      invoiceId: id,
      clientName: newInvoice.client,
      date: new Date().toISOString().slice(0, 10),
      amountHT: newInvoice.amountHT,
      vatRate: newInvoice.vatRate,
      status: "Brouillon",
    }, () => setNewInvoice({ client: "", amountHT: "", vatRate: "20" }));
  };

  const addExpense = () => {
    if (!newExpense.supplier || !newExpense.amountHT) return;
    const id = `ACH-${String(expenses.length + 1).padStart(3, "0")}`;
    addExpenseApi({
      expenseId: id,
      supplier: newExpense.supplier,
      category: newExpense.category || "Autre",
      date: new Date().toISOString().slice(0, 10),
      amountHT: newExpense.amountHT,
      vatRate: newExpense.vatRate,
    }, () => setNewExpense({ supplier: "", category: "", amountHT: "", vatRate: "20" }));
  };

  const downloadInvoicePDF = (inv: typeof invoices[0]) => {
    const doc = new jsPDF();
    const vatAmt = vat(inv.amountHT, inv.vatRate);
    const ttc = inv.amountHT + vatAmt;

    // Header band
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 38, "F");

    // Company name in header band
    doc.setTextColor(255, 255, 255);
    const invTextX = company.logo ? 52 : 14;
    if (company.logo) {
      try { doc.addImage(company.logo, "PNG", 13, 3, 34, 20); } catch { /* ignore */ }
    }
    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text(company.name, invTextX, 16);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text([company.legalForm, company.siret ? `SIRET ${company.siret}` : "", company.city].filter(Boolean).join(" · "), invTextX, 24);
    if (company.email || company.phone) {
      doc.text([company.email, company.phone].filter(Boolean).join(" · "), invTextX, 31);
    }

    // Invoice label top right (in band)
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("FACTURE", 196, 16, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(inv.id, 196, 24, { align: "right" });
    doc.text(`Émise le ${inv.date}`, 196, 31, { align: "right" });

    // Reset color
    doc.setTextColor(30, 30, 30);

    // Company address block (left, below band)
    let leftY = 46;
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("ÉMETTEUR", 14, leftY); leftY += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    if (company.address) { doc.text(company.address, 14, leftY); leftY += 5.5; }
    if (company.postalCode || company.city) { doc.text(`${company.postalCode} ${company.city}`.trim(), 14, leftY); leftY += 5.5; }
    if (company.vatNumber) { doc.text(`N° TVA : ${company.vatNumber}`, 14, leftY); }
    // Status badge
    const statusColors: Record<string, [number, number, number]> = {
      "Payée": [16, 185, 129],
      "En attente": [245, 158, 11],
      "Brouillon": [100, 116, 139],
    };
    const [r, g, b] = statusColors[inv.status] ?? [100, 116, 139];
    doc.setFillColor(r, g, b);
    doc.roundedRect(14, 76, 30, 6, 1, 1, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text(inv.status, 29, 80.5, { align: "center" });
    doc.setTextColor(30, 30, 30);

    // Client block
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(120, 44, 76, 30, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("FACTURÉ À", 128, 52);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.text(inv.client, 128, 60);

    // Find client info
    const clientInfo = clients.find((c) => c.name === inv.client);
    if (clientInfo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(clientInfo.email, 128, 67);
      doc.text(`SIRET : ${clientInfo.siret}`, 128, 73);
    }

    doc.setTextColor(30, 30, 30);

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 82, 196, 82);

    // Table header
    doc.setFillColor(30, 64, 175);
    doc.rect(14, 86, 182, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Description", 18, 92);
    doc.text("Qté", 128, 92, { align: "right" });
    doc.text("Prix HT", 155, 92, { align: "right" });
    doc.text("Montant HT", 196, 92, { align: "right" });

    // Table row
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 95, 182, 12, "F");
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Prestation — ${inv.client}`, 18, 103);
    doc.text("1", 128, 103, { align: "right" });
    doc.text(money(inv.amountHT), 155, 103, { align: "right" });
    doc.text(money(inv.amountHT), 196, 103, { align: "right" });

    // Totals block
    const totalsX = 130;
    let ty = 122;
    const lineH = 9;

    doc.setDrawColor(226, 232, 240);
    doc.line(totalsX, ty - 4, 196, ty - 4);

    const labelCol = totalsX + 2;
    const valCol = 196;

    const addTotalRow = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(bold ? 30 : 100, bold ? 30 : 116, bold ? 30 : 139);
      doc.text(label, labelCol, ty);
      doc.setTextColor(30, 30, 30);
      doc.text(value, valCol, ty, { align: "right" });
      ty += lineH;
    };

    addTotalRow("Montant HT", money(inv.amountHT));
    addTotalRow(`TVA (${inv.vatRate}%)`, money(vatAmt));
    doc.line(totalsX, ty - 3, 196, ty - 3);

    // TTC highlighted
    doc.setFillColor(30, 64, 175);
    doc.rect(totalsX, ty - 1, 66, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL TTC", labelCol, ty + 6);
    doc.text(money(ttc), valCol, ty + 6, { align: "right" });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (company.iban) {
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
      doc.text("Règlement par virement bancaire :", 14, 275);
      doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
      doc.text(`IBAN : ${company.iban}`, 14, 281);
    }
    doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(`${company.name} — ${[company.legalForm, company.siret ? `SIRET ${company.siret}` : ""].filter(Boolean).join(" · ")}`, 105, 288, { align: "center" });
    doc.text("Document généré automatiquement par ComptaSimple", 105, 293, { align: "center" });

    doc.save(`${inv.id}.pdf`);
  };

  const openEditClient = (idx: number) => {
    setEditingClientIndex(idx);
    const { _id: dbId, ...formData } = clients[idx];
    setEditingClientDbId(dbId);
    setNewClientForm(formData);
    setClientFormError("");
    setShowNewClientDialog(true);
  };

  const saveClient = () => {
    setClientFormError("");
    if (!newClientForm.name.trim()) { setClientFormError("Le nom du client est requis."); return; }
    if (!newClientForm.siret.trim()) { setClientFormError("Le numéro SIRET est requis."); return; }
    if (editingClientIndex !== null && editingClientDbId !== null) {
      updateClientApi(editingClientDbId, newClientForm, () => {
        setNewClientForm(emptyClientForm);
        setEditingClientIndex(null);
        setEditingClientDbId(null);
        setShowNewClientDialog(false);
      });
    } else {
      addClientApi(newClientForm, () => {
        setNewClientForm(emptyClientForm);
        setEditingClientIndex(null);
        setEditingClientDbId(null);
        setShowNewClientDialog(false);
      });
    }
  };

  const confirmDeleteClient = () => {
    if (deleteClientIndex === null) return;
    const clientToDelete = clients[deleteClientIndex];
    if (clientToDelete) {
      deleteClientApi(clientToDelete._id, () => setDeleteClientIndex(null));
    } else {
      setDeleteClientIndex(null);
    }
  };

  // Legacy stubs — bank connection now handled by GoCardless (gcStartAuth / gcDisconnect)
  const connectBank = () => { setShowBankDialog(false); };
  const disconnectBank = () => { void gcDisconnect(); };

  const filteredTransactions = transactions.filter((t) => {
    const matchSearch = `${t.label} ${t.category}`.toLowerCase().includes(txSearch.toLowerCase());
    const matchFilter = txFilter === "all" || (txFilter === "credit" && t.credit !== null) || (txFilter === "debit" && t.debit !== null);
    return matchSearch && matchFilter;
  });

  const bankTotals = useMemo(() => ({
    totalCredits: transactions.reduce((s, t) => s + (t.credit ?? 0), 0),
    totalDebits: transactions.reduce((s, t) => s + (t.debit ?? 0), 0),
    balance: transactions.length > 0 ? transactions[0].balance : 0,
  }), [transactions]);

  // Merge manual expenses + bank debit transactions into a unified list for the Dépenses tab
  const mergedExpenses = useMemo(() => {
    type MergedExpense = {
      id: string; supplier: string; category: string; date: string;
      amountHT: number; vatRate: number; source: "manual" | "bank";
    };

    const manual: MergedExpense[] = expenses.map((e) => ({ ...e, source: "manual" as const }));

    if (!bankConnected || transactions.length === 0) return manual;

    const bankRows: MergedExpense[] = transactions
      .filter((t) => t.debit !== null && t.category !== "Recette")
      .map((t) => {
        const rate = t.vatRate ?? 20;
        const amountHT = rate > 0 ? (t.debit! / (1 + rate / 100)) : t.debit!;
        return {
          id: t.id,
          supplier: t.label,
          category: t.category,
          date: t.date,
          amountHT: Math.round(amountHT * 100) / 100,
          vatRate: rate,
          source: "bank" as const,
        };
      });

    // Merge: manual first, then bank rows not already covered by a manual entry
    // (simple dedup by same date + rounded amount to avoid double-counting)
    const manualKeys = new Set(manual.map((e) => `${e.date}_${Math.round(e.amountHT)}`));
    const uniqueBank = bankRows.filter((b) => !manualKeys.has(`${b.date}_${Math.round(b.amountHT)}`));

    return [...manual, ...uniqueBank].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, transactions, bankConnected]);

  // Auto-match: for every credit transaction, find a "Payée" invoice whose client name
  // appears in the transaction label. Maps txId → { invoiceId, client }.
  const invoiceMatches = useMemo(() => {
    const map = new Map<string, { invoiceId: string; client: string; amountTTC: number }>();
    const paidInvoices = invoices.filter((i) => i.status === "Payée");
    for (const t of transactions) {
      if (t.credit === null) continue; // only credits
      const labelUp = t.label.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (const inv of paidInvoices) {
        const clientUp = inv.client.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (labelUp.includes(clientUp)) {
          // Prefer amount match (TTC), fall back to first name match
          const ttc = Number(inv.amountHT) * (1 + Number(inv.vatRate) / 100);
          const existing = map.get(t.id);
          if (!existing || Math.abs(ttc - t.credit) < Math.abs(existing.amountTTC - t.credit)) {
            map.set(t.id, { invoiceId: inv.id, client: inv.client, amountTTC: ttc });
          }
        }
      }
    }
    return map;
  }, [transactions, invoices]);

  const PIE_COLORS = ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#6366f1", "#a78bfa", "#f59e0b", "#10b981"];

  const reportData = useMemo(() => {
    const revenueHT = invoices.reduce((s, i) => s + Number(i.amountHT), 0);
    const chargesHT = expenses.reduce((s, e) => s + Number(e.amountHT), 0);
    const resultat = revenueHT - chargesHT;

    const revenueByClient = invoices.reduce<Record<string, number>>((acc, i) => {
      acc[i.client] = (acc[i.client] ?? 0) + Number(i.amountHT);
      return acc;
    }, {});

    const expensesByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amountHT);
      return acc;
    }, {});

    const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));
    const clientBarData = Object.entries(revenueByClient).map(([name, value]) => ({ name, value }));

    return { revenueHT, chargesHT, resultat, pieData, clientBarData, expensesByCategory, revenueByClient };
  }, [invoices, expenses]);

  const tvaData = useMemo(() => {
    const RATES = [0, 5.5, 10, 20];

    const salesByRate = RATES.map((rate) => {
      const rows = invoices.filter((i) => Number(i.vatRate) === rate);
      const baseHT = rows.reduce((s, i) => s + Number(i.amountHT), 0);
      const tvaAmount = baseHT * (rate / 100);
      return { rate, baseHT, tvaAmount, count: rows.length };
    }).filter((r) => r.count > 0);

    const purchasesByRate = RATES.map((rate) => {
      const rows = expenses.filter((e) => Number(e.vatRate) === rate);
      const baseHT = rows.reduce((s, e) => s + Number(e.amountHT), 0);
      const tvaAmount = baseHT * (rate / 100);
      return { rate, baseHT, tvaAmount, count: rows.length };
    }).filter((r) => r.count > 0);

    const tvaCollectee = salesByRate.reduce((s, r) => s + r.tvaAmount, 0);
    const tvaDeduc = purchasesByRate.reduce((s, r) => s + r.tvaAmount, 0);
    const solde = tvaCollectee - tvaDeduc;

    return { salesByRate, purchasesByRate, tvaCollectee, tvaDeduc, solde };
  }, [invoices, expenses]);

  const liasseData = useMemo(() => {
    const revenueHT = invoices.reduce((s, i) => s + Number(i.amountHT), 0);
    const chargesHT = expenses.reduce((s, e) => s + Number(e.amountHT), 0);
    const resultatNet = revenueHT - chargesHT;
    const tvaCollectee = invoices.reduce((s, i) => s + Number(i.amountHT) * (Number(i.vatRate) / 100), 0);
    const tvaDeductible = expenses.reduce((s, e) => s + Number(e.amountHT) * (Number(e.vatRate) / 100), 0);
    const tvaNetDue = tvaCollectee - tvaDeductible;
    const tresorerie = bankConnected ? bankTotals.balance : revenueHT - chargesHT + 10000;

    // Actif
    const immobilisations = 5000;
    const creancesClients = invoices.filter(i => i.status !== "Payée").reduce((s, i) => s + Number(i.amountHT) * (1 + Number(i.vatRate) / 100), 0);
    const totalActif = immobilisations + creancesClients + tresorerie;

    // Passif
    const capitalSocial = 10000;
    const report = 0;
    const detteFournisseurs = expenses.reduce((s, e) => s + Number(e.amountHT) * (1 + Number(e.vatRate) / 100), 0);
    const detteFiscale = tvaNetDue > 0 ? tvaNetDue : 0;
    const totalPassif = capitalSocial + report + resultatNet + detteFournisseurs + detteFiscale;

    return {
      revenueHT, chargesHT, resultatNet, tvaCollectee, tvaDeductible, tvaNetDue,
      tresorerie, immobilisations, creancesClients, totalActif,
      capitalSocial, report, detteFournisseurs, detteFiscale, totalPassif,
    };
  }, [invoices, expenses, bankConnected, bankTotals]);

  const exportLiassePDF = () => {
    const doc = new jsPDF();
    const ld = liasseData;
    const year = new Date().getFullYear();

    const drawBand = (y: number, h: number, r: number, g: number, b: number) => {
      doc.setFillColor(r, g, b); doc.rect(0, y, 210, h, "F");
    };

    // Header
    drawBand(0, 38, 30, 64, 175);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text(company.name, 14, 16);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text([company.legalForm, company.siret ? `SIRET ${company.siret}` : "", company.city].filter(Boolean).join(" · "), 14, 24);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("LIASSE FISCALE", 196, 16, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Exercice ${year}`, 196, 24, { align: "right" });
    doc.text("Formulaires 2050 / 2051 (simplifié)", 196, 31, { align: "right" });
    doc.setTextColor(30, 30, 30);

    // ── BILAN ACTIF (2050)
    let y = 44;
    const drawTableHeader = (title: string, yPos: number) => {
      doc.setFillColor(30, 64, 175);
      doc.rect(14, yPos, 182, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(title, 18, yPos + 5.5);
      doc.text("Montant (€)", 192, yPos + 5.5, { align: "right" });
      doc.setTextColor(30, 30, 30);
    };
    const drawRow = (label: string, value: number, yPos: number, bold = false, shade = false) => {
      if (shade) { doc.setFillColor(248, 250, 252); doc.rect(14, yPos - 3, 182, 7, "F"); }
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(8.5);
      doc.setTextColor(bold ? 30 : 60, bold ? 30 : 60, bold ? 30 : 60);
      doc.text(label, 18, yPos + 1.5);
      doc.setTextColor(bold ? 30 : 60, 30, 30);
      doc.text(money(value), 192, yPos + 1.5, { align: "right" });
      return yPos + 7;
    };

    drawTableHeader("BILAN — ACTIF (Formulaire 2050)", y); y += 10;
    y = drawRow("Immobilisations nettes", ld.immobilisations, y, false, false);
    y = drawRow("Créances clients (TTC)", ld.creancesClients, y, false, true);
    y = drawRow("Trésorerie disponible", ld.tresorerie, y, false, false);
    doc.setDrawColor(200, 210, 230); doc.line(14, y, 196, y); y += 3;
    y = drawRow("TOTAL ACTIF", ld.totalActif, y, true, true);

    y += 8;

    // ── BILAN PASSIF (2050 suite)
    drawTableHeader("BILAN — PASSIF (Formulaire 2050)", y); y += 10;
    y = drawRow("Capital social", ld.capitalSocial, y, false, false);
    y = drawRow("Report à nouveau", ld.report, y, false, true);
    y = drawRow("Résultat de l'exercice", ld.resultatNet, y, false, false);
    y = drawRow("Dettes fournisseurs (TTC)", ld.detteFournisseurs, y, false, true);
    y = drawRow("TVA à payer (dette fiscale)", ld.detteFiscale, y, false, false);
    doc.setDrawColor(200, 210, 230); doc.line(14, y, 196, y); y += 3;
    y = drawRow("TOTAL PASSIF", ld.totalPassif, y, true, true);

    y += 10;

    // ── COMPTE DE RÉSULTAT (2051)
    drawTableHeader("COMPTE DE RÉSULTAT (Formulaire 2051)", y); y += 10;
    y = drawRow("Chiffre d'affaires HT", ld.revenueHT, y, false, false);
    doc.setDrawColor(200, 210, 230); doc.line(14, y, 196, y); y += 2;
    y = drawRow("Total des charges d'exploitation HT", ld.chargesHT, y, false, true);
    doc.setDrawColor(200, 210, 230); doc.line(14, y, 196, y); y += 3;
    const isProfit = ld.resultatNet >= 0;
    doc.setTextColor(isProfit ? 16 : 239, isProfit ? 185 : 68, isProfit ? 129 : 68);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(isProfit ? "BÉNÉFICE NET" : "PERTE NETTE", 18, y + 2);
    doc.text(money(Math.abs(ld.resultatNet)), 192, y + 2, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 10;

    // ── TVA summary
    drawTableHeader("RÉCAPITULATIF TVA (CA3)", y); y += 10;
    y = drawRow("TVA collectée sur ventes", ld.tvaCollectee, y, false, false);
    y = drawRow("TVA déductible sur achats", ld.tvaDeductible, y, false, true);
    doc.setDrawColor(200, 210, 230); doc.line(14, y, 196, y); y += 3;
    doc.setTextColor(ld.tvaNetDue > 0 ? 239 : 16, ld.tvaNetDue > 0 ? 68 : 185, ld.tvaNetDue > 0 ? 68 : 129);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(ld.tvaNetDue > 0 ? "SOLDE À REVERSER AU TRÉSOR" : "CRÉDIT DE TVA", 18, y + 2);
    doc.text(money(Math.abs(ld.tvaNetDue)), 192, y + 2, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 12;

    // Footer disclaimer
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(14, y, 182, 18, 2, 2, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 80, 0);
    doc.text("Document généré à titre indicatif — Ne remplace pas la liasse fiscale officielle déposée via EDI.", 105, y + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Vérifiez et complétez avec votre expert-comptable avant dépôt sur impots.gouv.fr / espace professionnel.", 105, y + 12, { align: "center" });

    // Page footer
    doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text(`${company.name} · Liasse fiscale ${year} · Généré par ComptaSimple`, 105, 290, { align: "center" });

    doc.save(`liasse-fiscale-${year}.pdf`);
  };

  const exportTVAPDF = () => {
    const doc = new jsPDF();
    const { salesByRate, purchasesByRate, tvaCollectee, tvaDeduc, solde } = tvaData;

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont("helvetica", "bold");
    doc.text(company.name, 14, 17);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text([company.legalForm, company.siret ? `SIRET ${company.siret}` : ""].filter(Boolean).join(" · ") || "Déclaration de TVA — CA3", 14, 25);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("DÉCLARATION TVA", 196, 20, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Période : Mai 2026", 196, 28, { align: "right" });

    doc.setTextColor(30, 30, 30);

    const kpis = [
      { label: "TVA collectée", value: tvaCollectee, color: [239, 68, 68] as [number,number,number] },
      { label: "TVA déductible", value: tvaDeduc, color: [16, 185, 129] as [number,number,number] },
      { label: "Solde à reverser", value: solde, color: solde <= 0 ? [16, 185, 129] as [number,number,number] : [239, 68, 68] as [number,number,number] },
    ];
    kpis.forEach((k, i) => {
      const x = 14 + i * 65;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, 46, 62, 24, 2, 2, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(k.label.toUpperCase(), x + 4, 53);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.setTextColor(...k.color);
      doc.text(money(k.value), x + 4, 64);
    });

    doc.setTextColor(30, 30, 30);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 76, 196, 76);

    let y = 84;

    const drawSection = (title: string, rows: { rate: number; baseHT: number; tvaAmount: number }[], isCredit: boolean) => {
      doc.setFillColor(30, 64, 175);
      doc.rect(14, y - 5, 182, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(title, 18, y);
      doc.text("Base HT", 130, y, { align: "right" });
      doc.text("TVA", 196, y, { align: "right" });
      y += 6;

      doc.setTextColor(30, 30, 30);
      let total = 0;
      rows.forEach((r) => {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 182, 8, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.text(`Taux ${r.rate}%`, 18, y + 5.5);
        doc.text(money(r.baseHT), 130, y + 5.5, { align: "right" });
        doc.setTextColor(isCredit ? 239 : 16, isCredit ? 68 : 185, isCredit ? 68 : 129);
        doc.text(money(r.tvaAmount), 196, y + 5.5, { align: "right" });
        doc.setTextColor(30, 30, 30);
        total += r.tvaAmount;
        y += 9;
      });
      doc.setFont("helvetica", "bold");
      doc.text("Total", 18, y + 5.5);
      doc.setTextColor(isCredit ? 239 : 16, isCredit ? 68 : 185, isCredit ? 68 : 129);
      doc.text(money(total), 196, y + 5.5, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 14;
    };

    drawSection("TVA COLLECTÉE (VENTES)", salesByRate, true);
    drawSection("TVA DÉDUCTIBLE (ACHATS)", purchasesByRate, false);

    doc.setFillColor(30, 64, 175);
    doc.rect(14, y - 5, 182, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("SOLDE TVA À REVERSER", 18, y + 3);
    doc.text(money(solde), 196, y + 3, { align: "right" });

    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("ComptaSimple — Déclaration générée le " + new Date().toLocaleDateString("fr-FR") + " · Non officielle, à déposer sur impots.gouv.fr", 105, 285, { align: "center" });

    doc.save("declaration-tva-mai-2026.pdf");
  };

  const exportReportPDF = () => {
    const doc = new jsPDF();
    const { revenueHT, chargesHT, resultat, expensesByCategory, revenueByClient } = reportData;

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont("helvetica", "bold");
    doc.text(company.name, 14, 17);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text([company.legalForm, company.siret ? `SIRET ${company.siret}` : ""].filter(Boolean).join(" · ") || "Rapport mensuel — Mai 2026", 14, 25);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("COMPTE DE RÉSULTAT", 196, 20, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Période : Mai 2026", 196, 28, { align: "right" });

    doc.setTextColor(30, 30, 30);

    // KPI row
    const kpis = [
      { label: "Chiffre d'affaires HT", value: revenueHT, color: [16, 185, 129] as [number,number,number] },
      { label: "Charges HT", value: chargesHT, color: [239, 68, 68] as [number,number,number] },
      { label: "Résultat net", value: resultat, color: resultat >= 0 ? [16, 185, 129] as [number,number,number] : [239, 68, 68] as [number,number,number] },
    ];
    kpis.forEach((k, i) => {
      const x = 14 + i * 65;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, 46, 62, 24, 2, 2, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(k.label.toUpperCase(), x + 4, 53);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.setTextColor(...k.color);
      doc.text(money(k.value), x + 4, 64);
    });

    doc.setTextColor(30, 30, 30);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 76, 196, 76);

    // Revenue section
    let y = 84;
    doc.setFillColor(30, 64, 175);
    doc.rect(14, y - 5, 182, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("PRODUITS (REVENUS)", 18, y);
    doc.text("Montant HT", 196, y, { align: "right" });
    y += 6;

    doc.setTextColor(30, 30, 30);
    Object.entries(revenueByClient).forEach(([client, amt]) => {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 8, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(client, 18, y + 5.5);
      doc.setTextColor(16, 185, 129);
      doc.text(money(amt), 196, y + 5.5, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 9;
    });

    doc.setFont("helvetica", "bold");
    doc.text("Total revenus", 18, y + 5.5);
    doc.setTextColor(16, 185, 129);
    doc.text(money(revenueHT), 196, y + 5.5, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 14;

    // Expenses section
    doc.setFillColor(30, 64, 175);
    doc.rect(14, y - 5, 182, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("CHARGES (DÉPENSES)", 18, y);
    doc.text("Montant HT", 196, y, { align: "right" });
    y += 6;

    doc.setTextColor(30, 30, 30);
    Object.entries(expensesByCategory).forEach(([cat, amt]) => {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 8, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(cat, 18, y + 5.5);
      doc.setTextColor(239, 68, 68);
      doc.text(`− ${money(amt)}`, 196, y + 5.5, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 9;
    });

    doc.setFont("helvetica", "bold");
    doc.text("Total charges", 18, y + 5.5);
    doc.setTextColor(239, 68, 68);
    doc.text(`− ${money(chargesHT)}`, 196, y + 5.5, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 14;

    // Result line
    doc.setFillColor(30, 64, 175);
    doc.rect(14, y - 5, 182, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("RÉSULTAT NET AVANT IMPÔT", 18, y + 3);
    doc.text(money(resultat), 196, y + 3, { align: "right" });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("ComptaSimple — Rapport généré automatiquement le " + new Date().toLocaleDateString("fr-FR"), 105, 285, { align: "center" });

    doc.save("rapport-pl-mai-2026.pdf");
  };

  const exportCSV = () => {
    const rows = [
      ["type", "id", "tiers", "date", "montant_ht", "tva", "montant_ttc", "statut"],
      ...invoices.map((i) => ["vente", i.id, i.client, i.date, i.amountHT, vat(i.amountHT, i.vatRate), i.amountHT + vat(i.amountHT, i.vatRate), i.status]),
      ...expenses.map((e) => ["achat", e.id, e.supplier, e.date, e.amountHT, vat(e.amountHT, e.vatRate), e.amountHT + vat(e.amountHT, e.vatRate), e.category]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export-comptable.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Building2 className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight text-slate-900">ComptaSimple</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bonjour.</h1>
          <p className="text-slate-500">Voici la situation financière de votre entreprise.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={Euro} title="Chiffre d'affaires HT" value={money(totals.revenueHT)} subtitle="Total facturé" />
          <StatCard icon={Receipt} title="Achats HT" value={money(totals.expenseHT)} subtitle="Dépenses enregistrées" />
          <StatCard icon={FileText} title="TVA à payer estimée" value={money(totals.vatDue)} subtitle="TVA collectée - déductible" />
          <StatCard icon={Building2} title="Résultat estimé" value={money(totals.result)} subtitle="Avant impôts" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="w-full overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsList className="bg-slate-200/50 w-max min-w-full">
              <TabsTrigger value="dashboard" className="text-xs sm:text-sm px-2 sm:px-3">
                <span className="hidden sm:inline">Tableau de bord</span>
                <span className="sm:hidden">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="devis" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <FileSignature className="w-3.5 h-3.5 shrink-0" />
                Devis
                {devisList.filter(d => d.status === "Envoyé").length > 0 && (
                  <span className="ml-0.5 min-w-[16px] h-4 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {devisList.filter(d => d.status === "Envoyé").length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs sm:text-sm px-2 sm:px-3">Factures</TabsTrigger>
              <TabsTrigger value="expenses" className="text-xs sm:text-sm px-2 sm:px-3">Dépenses</TabsTrigger>
              <TabsTrigger value="clients" className="text-xs sm:text-sm px-2 sm:px-3">Clients</TabsTrigger>
              <TabsTrigger value="bank" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <Landmark className="w-3.5 h-3.5 shrink-0" />
                Banque
                {bankConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5 shrink-0" />}
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <FileBarChart className="w-3.5 h-3.5 shrink-0" />
                Rapports
              </TabsTrigger>
              <TabsTrigger value="tva" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                TVA
              </TabsTrigger>
              <TabsTrigger value="liasse" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <Scale className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">Liasse fiscale</span>
                <span className="md:hidden">Liasse</span>
              </TabsTrigger>
              <TabsTrigger value="fiscal" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Calendrier fiscal</span>
                <span className="sm:hidden">Fiscal</span>
                {(() => {
                  const today = new Date();
                  const overdue = [
                    "2026-02-24","2026-03-24","2026-03-15","2026-04-15","2026-04-24","2026-05-05","2026-01-31",
                  ].filter(d => new Date(d) < today).length;
                  return overdue > 0 ? (
                    <span className="ml-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                      {overdue}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Paramètres</span>
              </TabsTrigger>
              <TabsTrigger value="ia" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Comptable IA</span>
                <span className="sm:hidden">IA</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="outline-none">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-6">Synthèse du mois</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor' }} className="text-sm text-slate-500" />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} tick={{ fill: 'currentColor' }} className="text-sm text-slate-500" />
                      <Tooltip 
                        formatter={(value: any) => money(value)} 
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DEVIS TAB ── */}
          <TabsContent value="devis" className="space-y-6 outline-none">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Devis</h2>
                <p className="text-sm text-slate-500 mt-0.5">Créez vos devis et transformez-les en factures une fois acceptés.</p>
              </div>
              <Button onClick={() => setShowDevisDialog(true)} className="gap-2" data-testid="button-add-devis">
                <Plus className="w-4 h-4" />
                Nouveau devis
              </Button>
            </div>

            {/* Dialog création devis */}
            <Dialog open={showDevisDialog} onOpenChange={(open) => { setShowDevisDialog(open); if (!open) setDevisFormState({ client: "", subject: "", validityDays: "30", notes: "", paymentTerms: "Paiement à 30 jours", lines: [newDevisLine()] }); }}>
              <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg">Nouveau devis</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  {/* Ligne 1 : Client + Objet */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Client <span className="text-red-500">*</span></label>
                      <Select value={devisFormState.client} onValueChange={(v) => setDevisFormState({ ...devisFormState, client: v })}>
                        <SelectTrigger data-testid="input-devis-client"><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                          {clients.length === 0 && <SelectItem value="__none" disabled>Aucun client — ajoutez-en dans l'onglet Clients</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Objet du devis <span className="text-red-500">*</span></label>
                      <Input placeholder="Ex : Développement site web, Maintenance réseau…" value={devisFormState.subject} onChange={(e) => setDevisFormState({ ...devisFormState, subject: e.target.value })} />
                    </div>
                  </div>

                  {/* Ligne 2 : Validité + Conditions paiement */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Durée de validité</label>
                      <Select value={devisFormState.validityDays} onValueChange={(v) => setDevisFormState({ ...devisFormState, validityDays: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 jours</SelectItem>
                          <SelectItem value="30">30 jours</SelectItem>
                          <SelectItem value="45">45 jours</SelectItem>
                          <SelectItem value="60">60 jours</SelectItem>
                          <SelectItem value="90">90 jours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Conditions de paiement</label>
                      <Input placeholder="Ex : Paiement à 30 jours, Acompte 50%…" value={devisFormState.paymentTerms} onChange={(e) => setDevisFormState({ ...devisFormState, paymentTerms: e.target.value })} />
                    </div>
                  </div>

                  {/* Lignes du devis */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700">Lignes du devis</label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDevisFormState({ ...devisFormState, lines: [...devisFormState.lines, newDevisLine()] })} className="gap-1.5 h-8 text-xs">
                        <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b text-slate-500 text-xs">
                            <th className="px-3 py-2.5 text-left font-medium w-[36%]">Description</th>
                            <th className="px-3 py-2.5 text-right font-medium w-[8%]">Qté</th>
                            <th className="px-2 py-2.5 text-left font-medium w-[10%]">Unité</th>
                            <th className="px-3 py-2.5 text-right font-medium w-[14%]">PU HT (€)</th>
                            <th className="px-2 py-2.5 text-right font-medium w-[10%]">TVA</th>
                            <th className="px-3 py-2.5 text-right font-medium w-[14%]">Total HT</th>
                            <th className="px-2 py-2.5 w-[8%]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {devisFormState.lines.map((line, idx) => (
                            <tr key={line.id} className="hover:bg-slate-50/40">
                              <td className="px-2 py-1.5">
                                <Input className="h-8 border-slate-200 text-sm" placeholder="Description de la prestation…" value={line.description} onChange={(e) => updateDevisLine(idx, "description", e.target.value)} />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input className="h-8 border-slate-200 text-sm text-right w-16" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => updateDevisLine(idx, "quantity", Number(e.target.value))} />
                              </td>
                              <td className="px-2 py-1.5">
                                <Select value={line.unit} onValueChange={(v) => updateDevisLine(idx, "unit", v)}>
                                  <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["forfait", "h", "jour", "unité", "mois", "km", "m²"].map((u) => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-2 py-1.5">
                                <Input className="h-8 border-slate-200 text-sm text-right" type="number" min="0" step="0.01" placeholder="0,00" value={line.unitPrice || ""} onChange={(e) => updateDevisLine(idx, "unitPrice", Number(e.target.value))} data-testid="input-devis-amount" />
                              </td>
                              <td className="px-2 py-1.5">
                                <Select value={String(line.vatRate)} onValueChange={(v) => updateDevisLine(idx, "vatRate", Number(v))}>
                                  <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="20" className="text-xs">20%</SelectItem>
                                    <SelectItem value="10" className="text-xs">10%</SelectItem>
                                    <SelectItem value="5.5" className="text-xs">5,5%</SelectItem>
                                    <SelectItem value="0" className="text-xs">0%</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-1.5 text-right font-medium text-slate-700 tabular-nums text-sm">
                                {money(line.quantity * line.unitPrice)}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {devisFormState.lines.length > 1 && (
                                  <button onClick={() => removeDevisLine(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Totaux */}
                    <div className="flex justify-end pt-1">
                      <div className="w-72 space-y-1.5 text-sm border rounded-lg p-4 bg-slate-50">
                        {(() => {
                          const ht = devisFormState.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
                          const vatByRate = devisFormState.lines.reduce<Record<number, number>>((acc, l) => {
                            acc[l.vatRate] = (acc[l.vatRate] ?? 0) + l.quantity * l.unitPrice * (l.vatRate / 100);
                            return acc;
                          }, {});
                          const tva = Object.values(vatByRate).reduce((s, v) => s + v, 0);
                          return (
                            <>
                              <div className="flex justify-between text-slate-600">
                                <span>Total HT</span>
                                <span className="font-medium tabular-nums">{money(ht)}</span>
                              </div>
                              {Object.entries(vatByRate).map(([rate, amt]) => (
                                <div key={rate} className="flex justify-between text-slate-500">
                                  <span>TVA {rate}%</span>
                                  <span className="tabular-nums">{money(amt)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between font-bold text-slate-900 border-t pt-1.5">
                                <span>Total TTC</span>
                                <span className="tabular-nums">{money(ht + tva)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Notes / Mentions complémentaires</label>
                    <textarea
                      className="w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm shadow-sm min-h-[72px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Conditions particulières, délais de livraison, garanties…"
                      value={devisFormState.notes}
                      onChange={(e) => setDevisFormState({ ...devisFormState, notes: e.target.value })}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowDevisDialog(false)}>Annuler</Button>
                  <Button onClick={saveDevisForm} className="gap-2" disabled={!devisFormState.client || !devisFormState.subject}>
                    <Plus className="w-4 h-4" />
                    Créer le devis
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-3">
              {(["Brouillon", "Envoyé", "Accepté", "Refusé", "Transformé"] as const).map((status) => {
                const count = devisList.filter(d => d.status === status).length;
                if (count === 0) return null;
                const colorMap: Record<string, string> = {
                  Brouillon: "bg-slate-100 text-slate-600",
                  Envoyé: "bg-amber-100 text-amber-700",
                  Accepté: "bg-emerald-100 text-emerald-700",
                  Refusé: "bg-red-100 text-red-600",
                  Transformé: "bg-blue-100 text-blue-700",
                };
                return (
                  <span key={status} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${colorMap[status]}`}>
                    {status} <span className="font-bold">({count})</span>
                  </span>
                );
              })}
              <span className="ml-auto text-sm text-slate-400 self-center">
                CA potentiel : <span className="font-semibold text-slate-700">{money(devisList.filter(d => d.status !== "Refusé" && d.status !== "Transformé").reduce((s, d) => s + devisAmountHT(d), 0))}</span> HT
              </span>
            </div>

            {/* Devis list */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Tous les devis</h2>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-9 h-9 bg-slate-50/50"
                      placeholder="Rechercher..."
                      value={devisSearch}
                      onChange={(e) => setDevisSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b bg-slate-50/50 text-slate-500 font-medium">
                        <th className="py-3 px-4 font-medium">N° Devis</th>
                        <th className="py-3 px-4 font-medium">Client</th>
                        <th className="py-3 px-4 font-medium">Description</th>
                        <th className="py-3 px-4 font-medium">Valide jusqu'au</th>
                        <th className="py-3 px-4 font-medium text-right">HT</th>
                        <th className="py-3 px-4 font-medium text-right">TTC</th>
                        <th className="py-3 px-4 font-medium">Statut</th>
                        <th className="py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredDevis.map((d) => {
                        const lineHT = devisAmountHT(d);
                        const lineVAT = devisVAT(d);
                        const badgeClass: Record<string, string> = {
                          Brouillon: "bg-slate-100 text-slate-600 hover:bg-slate-100 shadow-none",
                          Envoyé: "bg-amber-100 text-amber-700 hover:bg-amber-100 shadow-none",
                          Accepté: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none",
                          Refusé: "bg-red-100 text-red-600 hover:bg-red-100 shadow-none",
                          Transformé: "bg-blue-100 text-blue-700 hover:bg-blue-100 shadow-none",
                        };
                        return (
                          <tr key={d.id} className={`hover:bg-slate-50/50 transition-colors ${d.status === "Refusé" ? "opacity-60" : ""}`}>
                            <td className="py-3 px-4 font-medium text-slate-900">{d.id}</td>
                            <td className="py-3 px-4">{d.client}</td>
                            <td className="py-3 px-4 text-slate-500 max-w-[180px] truncate">{d.subject}</td>
                            <td className="py-3 px-4 text-slate-500">{d.validUntil}</td>
                            <td className="py-3 px-4 text-right">{money(lineHT)}</td>
                            <td className="py-3 px-4 text-right font-medium">{money(lineHT + lineVAT)}</td>
                            <td className="py-3 px-4">
                              <Select
                                value={d.status}
                                onValueChange={(v) => updateDevisStatus(d.id, v as Devis["status"])}
                                disabled={d.status === "Transformé"}
                              >
                                <SelectTrigger className="h-7 w-32 text-xs border-0 p-0 shadow-none focus:ring-0">
                                  <Badge variant="outline" className={`cursor-pointer text-xs font-medium ${badgeClass[d.status]}`}>
                                    {d.status}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Brouillon">Brouillon</SelectItem>
                                  <SelectItem value="Envoyé">Envoyé</SelectItem>
                                  <SelectItem value="Accepté">Accepté</SelectItem>
                                  <SelectItem value="Refusé">Refusé</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => downloadDevisPDF(d)}
                                  className="h-8 gap-1 text-xs text-slate-500 hover:text-primary hover:bg-primary/5 px-2"
                                  data-testid={`button-download-devis-${d.id}`}
                                  title="Télécharger PDF"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                  PDF
                                </Button>
                                {(d.status === "Accepté") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => convertToInvoice(d)}
                                    className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                                    data-testid={`button-convert-devis-${d.id}`}
                                    title="Convertir en facture"
                                  >
                                    <ArrowRightCircle className="w-3.5 h-3.5" />
                                    Facturer
                                  </Button>
                                )}
                                {d.status === "Brouillon" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateDevisStatus(d.id, "Envoyé")}
                                    className="h-8 gap-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2"
                                    title="Marquer comme envoyé"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Envoyer
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredDevis.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                            Aucun devis ne correspond à votre recherche.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6 outline-none">
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Toutes les factures</h2>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-9 h-9 bg-slate-50/50" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b bg-slate-50/50 text-slate-500 font-medium">
                        <th className="py-3 px-4 font-medium">N° Facture</th>
                        <th className="py-3 px-4 font-medium">Client</th>
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium text-right">HT</th>
                        <th className="py-3 px-4 font-medium text-right">TVA</th>
                        <th className="py-3 px-4 font-medium text-right">TTC</th>
                        <th className="py-3 px-4 font-medium">Statut</th>
                        <th className="py-3 px-4 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredInvoices.map((i) => (
                        <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-900">{i.id}</td>
                          <td className="py-3 px-4">{i.client}</td>
                          <td className="py-3 px-4 text-slate-500">{i.date}</td>
                          <td className="py-3 px-4 text-right">{money(i.amountHT)}</td>
                          <td className="py-3 px-4 text-right text-slate-500">{money(vat(i.amountHT, i.vatRate))}</td>
                          <td className="py-3 px-4 text-right font-medium">{money(i.amountHT + vat(i.amountHT, i.vatRate))}</td>
                          <td className="py-3 px-4">
                            <Badge variant={i.status === 'Payée' ? 'default' : i.status === 'En attente' ? 'secondary' : 'outline'} 
                                   className={
                                     i.status === 'Payée' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none' : 
                                     i.status === 'En attente' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 shadow-none' : 
                                     'bg-slate-100 text-slate-700 hover:bg-slate-100 shadow-none'
                                   }>
                              {i.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadInvoicePDF(i)}
                              className="h-8 gap-1.5 text-xs text-slate-500 hover:text-primary hover:bg-primary/5"
                              data-testid={`button-download-pdf-${i.id}`}
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-6 outline-none">
            {/* Summary banner when bank is connected */}
            {bankConnected && (
              <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <Landmark className="w-4 h-4 flex-shrink-0 text-blue-500" />
                <p>
                  <strong>{mergedExpenses.filter((e) => e.source === "bank").length} dépenses</strong> ont été importées automatiquement depuis votre compte bancaire.
                  Les lignes manuelles sont conservées et les doublons sont exclus.
                </p>
              </div>
            )}

            <Card className="shadow-sm">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b bg-slate-50/50 text-slate-500 font-medium">
                      <th className="py-3 px-4 font-medium">N° / Réf.</th>
                      <th className="py-3 px-4 font-medium">Fournisseur / Libellé</th>
                      <th className="py-3 px-4 font-medium">Catégorie</th>
                      <th className="py-3 px-4 font-medium">Date</th>
                      <th className="py-3 px-4 font-medium">Source</th>
                      <th className="py-3 px-4 font-medium text-right">HT</th>
                      <th className="py-3 px-4 font-medium text-right">TVA</th>
                      <th className="py-3 px-4 font-medium text-right">TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mergedExpenses.map((e) => (
                      <tr key={e.id} className={`hover:bg-slate-50/50 transition-colors ${e.source === "bank" ? "bg-blue-50/30" : ""}`}>
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">{e.id}</td>
                        <td className="py-3 px-4 max-w-[220px] truncate" title={e.supplier}>{e.supplier}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal shadow-none">{e.category}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{e.date}</td>
                        <td className="py-3 px-4">
                          {e.source === "bank" ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                              <Landmark className="w-3 h-3" />
                              Banque
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 whitespace-nowrap">
                              <Pencil className="w-3 h-3" />
                              Manuel
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">{money(e.amountHT)}</td>
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">{money(vat(e.amountHT, e.vatRate))}</td>
                        <td className="py-3 px-4 text-right font-medium whitespace-nowrap">{money(e.amountHT + vat(e.amountHT, e.vatRate))}</td>
                      </tr>
                    ))}
                    {mergedExpenses.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">Aucune dépense enregistrée.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="outline-none">
            <Card className="shadow-sm">
              <CardContent className="p-0 overflow-x-auto">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Répertoire clients</h2>
                  <Button
                    size="sm"
                    onClick={() => { setShowNewClientDialog(true); setClientFormError(""); }}
                    className="gap-2"
                    data-testid="button-new-client"
                  >
                    <UserPlus className="w-4 h-4" />
                    Nouveau client
                  </Button>
                </div>
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b bg-slate-50/50 text-slate-500">
                      <th className="py-3 px-4 font-medium">Client</th>
                      <th className="py-3 px-4 font-medium">Forme juridique</th>
                      <th className="py-3 px-4 font-medium">Email</th>
                      <th className="py-3 px-4 font-medium">Téléphone</th>
                      <th className="py-3 px-4 font-medium">Adresse</th>
                      <th className="py-3 px-4 font-medium">SIRET</th>
                      <th className="py-3 px-4 font-medium w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clients.map((c, idx) => (
                      <tr key={`${c.siret}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 px-4 font-medium text-slate-900">{c.name}</td>
                        <td className="py-3 px-4">
                          {c.legalForm && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary font-medium shadow-none text-xs">
                              {c.legalForm}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          <a href={`mailto:${c.email}`} className="hover:text-primary transition-colors flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />{c.email}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{c.phone || <span className="text-slate-300">—</span>}</td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {c.address ? `${c.address}, ${c.postalCode} ${c.city}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{c.siret}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditClient(idx)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-primary hover:bg-primary/5"
                              data-testid={`button-edit-client-${idx}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteClientIndex(idx)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                              data-testid={`button-delete-client-${idx}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clients.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-sm">Aucun client enregistré. Ajoutez votre premier client.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── REPORTS TAB ── */}
          <TabsContent value="reports" className="outline-none space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Compte de résultat</h2>
                <p className="text-sm text-slate-500">Période : Mai 2026 — données issues de vos factures et dépenses</p>
              </div>
              <Button onClick={exportReportPDF} className="gap-2" data-testid="button-export-report-pdf">
                <Download className="w-4 h-4" />
                Exporter en PDF
              </Button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-50"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Chiffre d'affaires HT</p>
                    <p className="text-2xl font-bold text-emerald-600">{money(reportData.revenueHT)}</p>
                    <p className="text-xs text-slate-400">{invoices.length} facture(s) émise(s)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-red-50"><TrendingDown className="w-5 h-5 text-red-500" /></div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Charges HT</p>
                    <p className="text-2xl font-bold text-red-500">{money(reportData.chargesHT)}</p>
                    <p className="text-xs text-slate-400">{expenses.length} dépense(s) enregistrée(s)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={`shadow-sm ${reportData.resultat >= 0 ? "border-emerald-200 bg-emerald-50/30" : "border-red-200 bg-red-50/30"}`}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${reportData.resultat >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                    <Euro className={`w-5 h-5 ${reportData.resultat >= 0 ? "text-emerald-700" : "text-red-600"}`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Résultat net avant impôt</p>
                    <p className={`text-2xl font-bold ${reportData.resultat >= 0 ? "text-emerald-700" : "text-red-600"}`}>{money(reportData.resultat)}</p>
                    <p className="text-xs text-slate-400">Marge : {reportData.revenueHT > 0 ? Math.round((reportData.resultat / reportData.revenueHT) * 100) : 0}%</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expenses pie chart */}
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChartIcon className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-slate-800">Charges par catégorie</h3>
                  </div>
                  {reportData.pieData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData.pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                            labelLine={false}
                          >
                            {reportData.pieData.map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => money(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Aucune dépense enregistrée</div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue by client bar chart */}
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-slate-800">CA HT par client</h3>
                  </div>
                  {reportData.clientBarData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.clientBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={110} />
                          <Tooltip formatter={(v: number) => money(v)} />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Aucune facture émise</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed P&L table */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">Détail du compte de résultat</h3>
                </div>
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b bg-slate-50/50 text-slate-500">
                      <th className="py-3 px-4 font-medium">Ligne</th>
                      <th className="py-3 px-4 font-medium">Détail</th>
                      <th className="py-3 px-4 font-medium text-right">Montant HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="bg-emerald-50/50">
                      <td colSpan={3} className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-emerald-700">Produits</td>
                    </tr>
                    {Object.entries(reportData.revenueByClient).map(([client, amt]) => (
                      <tr key={client} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500">Ventes</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{client}</td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600">{money(amt)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 font-semibold">
                      <td className="py-3 px-4" colSpan={2}>Total produits</td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-bold">{money(reportData.revenueHT)}</td>
                    </tr>
                    <tr className="bg-red-50/50">
                      <td colSpan={3} className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-red-600">Charges</td>
                    </tr>
                    {Object.entries(reportData.expensesByCategory).map(([cat, amt]) => (
                      <tr key={cat} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500">Charge</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{cat}</td>
                        <td className="py-3 px-4 text-right font-medium text-red-500">− {money(amt)}</td>
                      </tr>
                    ))}
                    <tr className="bg-red-50 font-semibold">
                      <td className="py-3 px-4" colSpan={2}>Total charges</td>
                      <td className="py-3 px-4 text-right text-red-600 font-bold">− {money(reportData.chargesHT)}</td>
                    </tr>
                    <tr className={`font-bold text-base ${reportData.resultat >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                      <td className="py-4 px-4" colSpan={2}>
                        <span className={reportData.resultat >= 0 ? "text-emerald-800" : "text-red-700"}>
                          Résultat net avant impôt
                        </span>
                      </td>
                      <td className={`py-4 px-4 text-right text-xl ${reportData.resultat >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {money(reportData.resultat)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BANK TAB ── */}
          <TabsContent value="bank" className="outline-none space-y-6">
            {!bankConnected ? (
              /* NOT CONNECTED — GoCardless Real Bank Connection */
              <div className="space-y-6 max-w-2xl mx-auto w-full">
                {/* Header */}
                <div className="text-center space-y-2 pt-6">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Landmark className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Connectez votre vrai compte bancaire</h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm">
                    Connexion sécurisée Open Banking via GoCardless — compatible avec +2 000 banques européennes.
                  </p>
                </div>

                {/* Syncing state */}
                {gcSyncing && (
                  <div className="flex flex-col items-center justify-center gap-3 py-10">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="font-semibold text-slate-800">Synchronisation en cours…</p>
                      <p className="text-sm text-slate-500">Récupération de vos transactions bancaires</p>
                    </div>
                  </div>
                )}

                {/* Error */}
                {gcError && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">Erreur</p>
                      <p>{gcError}</p>
                    </div>
                    <button onClick={() => setGcError(null)} className="text-red-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {/* Not configured */}
                {gcConfigured === false && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm space-y-2">
                    <p className="font-semibold text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Configuration Tink requise
                    </p>
                    <p className="text-amber-700">
                      Créez une application sur{" "}
                      <a href="https://console.tink.com" target="_blank" rel="noreferrer" className="underline font-medium">
                        console.tink.com
                      </a>{" "}
                      → notez le <strong>Client ID</strong> et le <strong>Client Secret</strong>.
                    </p>
                    <p className="text-amber-700">
                      Puis ajoutez{" "}
                      <code className="bg-amber-100 px-1 rounded text-xs">TINK_CLIENT_ID</code> et{" "}
                      <code className="bg-amber-100 px-1 rounded text-xs">TINK_CLIENT_SECRET</code>{" "}
                      dans les Variables d'environnement de l'application.
                    </p>
                  </div>
                )}

                {/* Tink CTA — shown unless syncing or unconfigured */}
                {!gcSyncing && gcConfigured !== false && (
                  <div className="flex flex-col items-center gap-6 py-4">
                    {/* Bank logos strip */}
                    <div className="flex flex-wrap justify-center gap-3 max-w-sm">
                      {["BNP Paribas", "Crédit Agricole", "Société Générale", "Qonto", "Boursorama", "LCL"].map(name => (
                        <span key={name} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                          {name}
                        </span>
                      ))}
                      <span className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-400">
                        +3 000 autres…
                      </span>
                    </div>

                    <Button
                      onClick={tinkStartAuth}
                      disabled={gcConnecting}
                      size="lg"
                      className="gap-2 px-8"
                      data-testid="button-connect-bank"
                    >
                      {gcConnecting ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Redirection en cours…</>
                      ) : (
                        <><Landmark className="w-4 h-4" /> Connecter ma banque</>
                      )}
                    </Button>

                    <p className="text-xs text-slate-400 text-center max-w-xs">
                      Vous serez redirigé vers Tink pour vous authentifier directement auprès de votre banque.
                    </p>
                  </div>
                )}

                {/* Security badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pb-6">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  Vos identifiants bancaires ne transitent jamais par ComptaSimple — connexion directe Open Banking (PSD2)
                </div>
              </div>
            ) : (
              /* CONNECTED */
              <div className="space-y-6">
                {/* Account summary */}
                <Card className="shadow-sm border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Landmark className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{bankInfo.name}</p>
                        <p className="text-sm text-slate-500 font-mono">
                          {bankInfo.iban.slice(0, 4)} {bankInfo.iban.slice(4, 8)} •••• •••• •••• {bankInfo.iban.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Solde actuel</p>
                        <p className="text-2xl font-bold text-slate-900">{money(bankTotals.balance)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500" onClick={gcRefresh} disabled={gcSyncing}>
                          <RefreshCw className={`w-3.5 h-3.5 ${gcSyncing ? "animate-spin" : ""}`} /> Actualiser
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-red-400 hover:text-red-500 hover:bg-red-50" onClick={gcDisconnect}>
                          <Unlink className="w-3.5 h-3.5" /> Déconnecter
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="shadow-sm">
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-50"><ArrowDownLeft className="w-5 h-5 text-emerald-600" /></div>
                      <div>
                        <p className="text-xs text-slate-500">Total encaissé</p>
                        <p className="text-lg font-bold text-emerald-600">{money(bankTotals.totalCredits)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-red-50"><ArrowUpRight className="w-5 h-5 text-red-500" /></div>
                      <div>
                        <p className="text-xs text-slate-500">Total décaissé</p>
                        <p className="text-lg font-bold text-red-500">{money(bankTotals.totalDebits)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10"><TrendingUp className="w-5 h-5 text-primary" /></div>
                      <div>
                        <p className="text-xs text-slate-500">Flux net</p>
                        <p className={`text-lg font-bold ${bankTotals.totalCredits - bankTotals.totalDebits >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {money(bankTotals.totalCredits - bankTotals.totalDebits)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Transactions list */}
                <Card className="shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <h2 className="text-lg font-semibold">Transactions</h2>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input className="pl-9 h-9 w-52 bg-slate-50/50 text-sm" placeholder="Rechercher…" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1 border rounded-lg p-1 bg-slate-50/50">
                          {([["all", "Tout"], ["credit", "Encaissements"], ["debit", "Décaissements"]] as const).map(([val, label]) => (
                            <button
                              key={val}
                              onClick={() => setTxFilter(val)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${txFilter === val ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Hidden file input — accept images + PDF, enable camera capture on mobile */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {/* Hidden file input for logo upload */}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const b64 = await resizeLogoToBase64(file);
                          setCompanyForm((f) => ({ ...f, logo: b64 }));
                        }
                        e.target.value = "";
                      }}
                    />

                    {/* OCR result notification */}
                    {ocrResult && (
                      <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 animate-in fade-in slide-in-from-top-2">
                        <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-500" />
                        <div className="flex-1">
                          <span className="font-semibold">OCR IA —</span>{" "}
                          {ocrResult.vatRate !== null
                            ? <>TVA détectée : <strong>{ocrResult.vatRate}%</strong>{ocrResult.supplier ? <>, fournisseur : <strong>{ocrResult.supplier}</strong></> : null}{ocrResult.amountHT !== null ? <>, montant HT : <strong>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ocrResult.amountHT)}</strong></> : null}. Les champs ont été pré-remplis automatiquement.</>
                            : <>Aucune TVA identifiée sur ce justificatif. Vérifiez et ajustez manuellement si nécessaire.</>
                          }
                        </div>
                        <button onClick={() => setOcrResult(null)} className="text-violet-400 hover:text-violet-600 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b bg-slate-50/50 text-slate-500">
                            <th className="py-3 px-4 font-medium whitespace-nowrap">Date</th>
                            <th className="py-3 px-4 font-medium">Libellé</th>
                            <th className="py-3 px-4 font-medium">Catégorie</th>
                            <th className="py-3 px-4 font-medium whitespace-nowrap">TVA</th>
                            <th className="py-3 px-4 font-medium whitespace-nowrap">Justificatif</th>
                            <th className="py-3 px-4 font-medium text-right whitespace-nowrap">Débit</th>
                            <th className="py-3 px-4 font-medium text-right whitespace-nowrap">Crédit</th>
                            <th className="py-3 px-4 font-medium text-right whitespace-nowrap">Solde</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredTransactions.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{t.date}</td>
                              <td className="py-3 px-4 font-medium text-slate-900 max-w-[200px] truncate">{t.label}</td>

                              {/* Catégorie */}
                              <td className="py-3 px-4">
                                <Select
                                  value={t.category}
                                  onValueChange={(v) => updateTransactionCategory(t.id, v)}
                                >
                                  <SelectTrigger className="h-7 text-xs border-0 bg-slate-100 hover:bg-slate-200 text-slate-600 shadow-none w-auto gap-1 px-2.5 focus:ring-0 focus:ring-offset-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TRANSACTION_CATEGORIES.map((cat) => (
                                      <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>

                              {/* TVA */}
                              <td className="py-3 px-4">
                                <Select
                                  value={t.vatRate !== null ? String(t.vatRate) : "__none__"}
                                  onValueChange={(v) => updateTransactionVatRate(t.id, v === "__none__" ? null : Number(v))}
                                >
                                  <SelectTrigger className="h-7 text-xs border-0 bg-slate-100 hover:bg-slate-200 text-slate-600 shadow-none w-[72px] gap-1 px-2.5 focus:ring-0 focus:ring-offset-0">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__" className="text-xs text-slate-400">Aucune</SelectItem>
                                    <SelectItem value="0" className="text-xs">0 %</SelectItem>
                                    <SelectItem value="5.5" className="text-xs">5,5 %</SelectItem>
                                    <SelectItem value="10" className="text-xs">10 %</SelectItem>
                                    <SelectItem value="20" className="text-xs">20 %</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>

                              {/* Justificatif */}
                              <td className="py-3 px-4">
                                {ocrLoadingTxId === t.id ? (
                                  // OCR in progress
                                  <div className="flex items-center gap-1.5 text-violet-600">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                                    <span className="text-xs whitespace-nowrap">Analyse…</span>
                                  </div>
                                ) : t.documentName ? (
                                  // Manual file attachment
                                  <div className="flex items-center gap-1 max-w-[160px]">
                                    <Paperclip className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                    <span className="text-xs text-blue-600 truncate" title={t.documentName}>
                                      {t.documentName}
                                    </span>
                                    <button
                                      onClick={() => removeDocument(t.id)}
                                      className="ml-0.5 flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                                      title="Supprimer le justificatif"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : invoiceMatches.get(t.id) ? (
                                  // Auto-matched paid invoice
                                  <div className="flex items-center gap-1.5" title={`Facture liée automatiquement — ${invoiceMatches.get(t.id)!.client}`}>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">
                                      <Link2 className="w-3 h-3 flex-shrink-0" />
                                      <span className="text-xs font-medium whitespace-nowrap">
                                        {invoiceMatches.get(t.id)!.invoiceId}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => attachDocument(t.id)}
                                      className="text-slate-300 hover:text-blue-500 transition-colors"
                                      title="Ajouter un justificatif (photo ou fichier)"
                                    >
                                      <Camera className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  // No document yet — show camera + scan hint
                                  <button
                                    onClick={() => attachDocument(t.id)}
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-600 transition-colors group"
                                    title="Photo ou fichier — OCR TVA automatique"
                                  >
                                    <ScanLine className="w-3.5 h-3.5" />
                                    <span className="hidden group-hover:inline whitespace-nowrap">Photo / fichier</span>
                                  </button>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right font-medium text-red-500 whitespace-nowrap">
                                {t.debit !== null ? `− ${money(t.debit)}` : <span className="text-slate-200">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-emerald-600 whitespace-nowrap">
                                {t.credit !== null ? `+ ${money(t.credit)}` : <span className="text-slate-200">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-700 font-medium whitespace-nowrap">{money(t.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredTransactions.length === 0 && (
                        <div className="py-12 text-center text-slate-400 text-sm">Aucune transaction ne correspond à votre recherche.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── TVA TAB ── */}
          <TabsContent value="tva" className="outline-none space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Déclaration TVA — CA3</h2>
                <p className="text-sm text-slate-500">Période : Mai 2026 · Régime réel normal · Non officielle — à déposer sur impots.gouv.fr</p>
              </div>
              <Button onClick={exportTVAPDF} className="gap-2" data-testid="button-export-tva-pdf">
                <Download className="w-4 h-4" />
                Exporter en PDF
              </Button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-red-50"><Receipt className="w-5 h-5 text-red-500" /></div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">TVA collectée (ventes)</p>
                    <p className="text-2xl font-bold text-red-500">{money(tvaData.tvaCollectee)}</p>
                    <p className="text-xs text-slate-400">Sur {invoices.length} facture(s)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-50"><Calculator className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">TVA déductible (achats)</p>
                    <p className="text-2xl font-bold text-emerald-600">{money(tvaData.tvaDeduc)}</p>
                    <p className="text-xs text-slate-400">Sur {expenses.length} dépense(s)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={`shadow-sm ${tvaData.solde > 0 ? "border-red-200 bg-red-50/30" : "border-emerald-200 bg-emerald-50/30"}`}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${tvaData.solde > 0 ? "bg-red-100" : "bg-emerald-100"}`}>
                    {tvaData.solde > 0
                      ? <AlertCircle className="w-5 h-5 text-red-600" />
                      : <CheckCircle2 className="w-5 h-5 text-emerald-700" />}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Solde TVA à reverser</p>
                    <p className={`text-2xl font-bold ${tvaData.solde > 0 ? "text-red-600" : "text-emerald-700"}`}>{money(tvaData.solde)}</p>
                    <p className="text-xs text-slate-400">{tvaData.solde > 0 ? "À payer à la DGFiP" : "Crédit de TVA"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Declaration detail table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* TVA collectée detail */}
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="p-4 border-b flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-red-400" />
                    <h3 className="font-semibold text-slate-800">TVA collectée sur ventes</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/50 text-slate-500">
                        <th className="py-2.5 px-4 text-left font-medium">Taux</th>
                        <th className="py-2.5 px-4 text-right font-medium">Base HT</th>
                        <th className="py-2.5 px-4 text-right font-medium">TVA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tvaData.salesByRate.map((r) => (
                        <tr key={r.rate} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-xs">{r.rate}%</Badge>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 font-medium">{money(r.baseHT)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-red-500">{money(r.tvaAmount)}</td>
                        </tr>
                      ))}
                      {tvaData.salesByRate.length === 0 && (
                        <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-sm">Aucune vente enregistrée</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-red-50 font-bold border-t">
                        <td className="py-3 px-4 text-red-700" colSpan={2}>Total TVA collectée</td>
                        <td className="py-3 px-4 text-right text-red-600">{money(tvaData.tvaCollectee)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {/* TVA déductible detail */}
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="p-4 border-b flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-semibold text-slate-800">TVA déductible sur achats</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/50 text-slate-500">
                        <th className="py-2.5 px-4 text-left font-medium">Taux</th>
                        <th className="py-2.5 px-4 text-right font-medium">Base HT</th>
                        <th className="py-2.5 px-4 text-right font-medium">TVA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tvaData.purchasesByRate.map((r) => (
                        <tr key={r.rate} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-xs">{r.rate}%</Badge>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 font-medium">{money(r.baseHT)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-600">{money(r.tvaAmount)}</td>
                        </tr>
                      ))}
                      {tvaData.purchasesByRate.length === 0 && (
                        <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-sm">Aucun achat enregistré</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50 font-bold border-t">
                        <td className="py-3 px-4 text-emerald-700" colSpan={2}>Total TVA déductible</td>
                        <td className="py-3 px-4 text-right text-emerald-600">{money(tvaData.tvaDeduc)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* CA3 recap cadre */}
            <Card className="shadow-sm border-primary/20">
              <CardContent className="p-0">
                <div className="p-4 border-b bg-primary/5 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-slate-800">Récapitulatif CA3 — Résumé de la déclaration</h3>
                </div>
                <div className="divide-y">
                  {[
                    { code: "01", label: "Ventes et prestations de services (CA total HT)", value: reportData.revenueHT, color: "" },
                    { code: "08", label: "TVA brute — TVA collectée sur opérations taxables", value: tvaData.tvaCollectee, color: "text-red-500" },
                    { code: "20", label: "TVA déductible sur achats de biens et services", value: tvaData.tvaDeduc, color: "text-emerald-600" },
                    { code: "25", label: "Crédit de TVA reporté du mois précédent", value: 0, color: "" },
                  ].map((row) => (
                    <div key={row.code} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{row.code}</span>
                        <span className="text-sm text-slate-700">{row.label}</span>
                      </div>
                      <span className={`font-semibold text-sm ${row.color || "text-slate-900"}`}>{money(row.value)}</span>
                    </div>
                  ))}
                  <div className={`flex items-center justify-between px-6 py-4 font-bold ${tvaData.solde > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${tvaData.solde > 0 ? "bg-red-200 text-red-700" : "bg-emerald-200 text-emerald-700"}`}>28</span>
                      <span className={`text-sm ${tvaData.solde > 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {tvaData.solde > 0 ? "TVA à payer (ligne 28 — virement DGFiP)" : "Crédit de TVA à reporter (ligne 26)"}
                      </span>
                    </div>
                    <span className={`font-bold text-lg ${tvaData.solde > 0 ? "text-red-600" : "text-emerald-700"}`}>{money(Math.abs(tvaData.solde))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
              <p>
                Cette déclaration est générée automatiquement à partir de vos données ComptaSimple. Elle est indicative et ne remplace pas la déclaration officielle.
                Déposez votre CA3 sur <strong>impots.gouv.fr</strong> avant le 24 du mois suivant la période concernée.
              </p>
            </div>
          </TabsContent>

          {/* ── LIASSE FISCALE TAB ── */}
          <TabsContent value="liasse" className="outline-none space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Liasse fiscale</h2>
                <p className="text-sm text-slate-500">Bilan comptable (2050) + Compte de résultat (2051) + Récapitulatif TVA (CA3)</p>
              </div>
              <Button onClick={exportLiassePDF} className="gap-2">
                <FileDown className="w-4 h-4" />
                Exporter la liasse PDF
              </Button>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
              <p>
                Cette liasse est générée automatiquement à partir de vos données ComptaSimple à titre <strong>indicatif</strong>.
                La déclaration officielle doit être déposée via <strong>EDI</strong> (expert-comptable ou logiciel agréé DGFiP) ou directement sur votre espace professionnel sur <strong>impots.gouv.fr</strong>.
              </p>
            </div>

            {/* KPI summary row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Chiffre d'affaires HT", value: liasseData.revenueHT, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Charges HT", value: liasseData.chargesHT, color: "text-red-500", bg: "bg-red-50" },
                { label: liasseData.resultatNet >= 0 ? "Bénéfice net" : "Perte nette", value: Math.abs(liasseData.resultatNet), color: liasseData.resultatNet >= 0 ? "text-emerald-600" : "text-red-500", bg: liasseData.resultatNet >= 0 ? "bg-emerald-50" : "bg-red-50" },
                { label: "TVA nette due", value: liasseData.tvaNetDue, color: "text-blue-600", bg: "bg-blue-50" },
              ].map((kpi) => (
                <Card key={kpi.label} className={`shadow-sm border-0 ${kpi.bg}`}>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{kpi.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{money(kpi.value)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BILAN ACTIF */}
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50 rounded-t-lg">
                    <Scale className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-slate-800">Bilan Actif — Formulaire 2050</h3>
                  </div>
                  <div className="divide-y">
                    {[
                      { label: "Immobilisations nettes", value: liasseData.immobilisations, ref: "Ligne AB" },
                      { label: "Créances clients (TTC)", value: liasseData.creancesClients, ref: "Ligne BX" },
                      { label: "Trésorerie disponible", value: liasseData.tresorerie, ref: "Ligne BT" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{row.label}</p>
                          <p className="text-xs text-slate-400">{row.ref}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-800">{money(row.value)}</p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-3.5 bg-blue-50">
                      <p className="text-sm font-bold text-blue-900">TOTAL ACTIF</p>
                      <p className="text-base font-bold text-blue-700">{money(liasseData.totalActif)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* BILAN PASSIF */}
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50 rounded-t-lg">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-semibold text-slate-800">Bilan Passif — Formulaire 2050</h3>
                  </div>
                  <div className="divide-y">
                    {[
                      { label: "Capital social", value: liasseData.capitalSocial, ref: "Ligne DA" },
                      { label: "Report à nouveau", value: liasseData.report, ref: "Ligne DG" },
                      { label: "Résultat de l'exercice", value: liasseData.resultatNet, ref: "Ligne DI" },
                      { label: "Dettes fournisseurs (TTC)", value: liasseData.detteFournisseurs, ref: "Ligne DX" },
                      { label: "TVA à reverser (dette fiscale)", value: liasseData.detteFiscale, ref: "Ligne EH" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{row.label}</p>
                          <p className="text-xs text-slate-400">{row.ref}</p>
                        </div>
                        <p className={`text-sm font-semibold ${row.value < 0 ? "text-red-500" : "text-slate-800"}`}>{money(row.value)}</p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-50">
                      <p className="text-sm font-bold text-indigo-900">TOTAL PASSIF</p>
                      <p className="text-base font-bold text-indigo-700">{money(liasseData.totalPassif)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* COMPTE DE RÉSULTAT */}
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50 rounded-t-lg">
                    <BarChart2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-semibold text-slate-800">Compte de résultat — Formulaire 2051</h3>
                  </div>
                  <div className="divide-y">
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Chiffre d'affaires HT</p>
                        <p className="text-xs text-slate-400">Ligne FL</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-600">{money(liasseData.revenueHT)}</p>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Total charges d'exploitation</p>
                        <p className="text-xs text-slate-400">Ligne GF</p>
                      </div>
                      <p className="text-sm font-semibold text-red-500">- {money(liasseData.chargesHT)}</p>
                    </div>
                    <div className={`flex items-center justify-between px-5 py-3.5 ${liasseData.resultatNet >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                      <p className={`text-sm font-bold ${liasseData.resultatNet >= 0 ? "text-emerald-900" : "text-red-900"}`}>
                        {liasseData.resultatNet >= 0 ? "BÉNÉFICE NET" : "PERTE NETTE"}
                      </p>
                      <p className={`text-base font-bold ${liasseData.resultatNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {money(Math.abs(liasseData.resultatNet))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* TVA récap */}
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50 rounded-t-lg">
                    <ClipboardList className="w-4 h-4 text-slate-500" />
                    <h3 className="font-semibold text-slate-800">Récapitulatif TVA (CA3)</h3>
                  </div>
                  <div className="divide-y">
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60">
                      <div>
                        <p className="text-sm font-medium text-slate-700">TVA collectée</p>
                        <p className="text-xs text-slate-400">Ligne 08</p>
                      </div>
                      <p className="text-sm font-semibold text-red-500">{money(liasseData.tvaCollectee)}</p>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60">
                      <div>
                        <p className="text-sm font-medium text-slate-700">TVA déductible</p>
                        <p className="text-xs text-slate-400">Ligne 20</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-600">- {money(liasseData.tvaDeductible)}</p>
                    </div>
                    <div className={`flex items-center justify-between px-5 py-3.5 ${liasseData.tvaNetDue > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                      <p className={`text-sm font-bold ${liasseData.tvaNetDue > 0 ? "text-red-900" : "text-emerald-900"}`}>
                        {liasseData.tvaNetDue > 0 ? "SOLDE À REVERSER" : "CRÉDIT DE TVA"}
                      </p>
                      <p className={`text-base font-bold ${liasseData.tvaNetDue > 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {money(Math.abs(liasseData.tvaNetDue))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workflow télédéclaration */}
            <Card className="shadow-sm border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <ExternalLink className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-800 text-base">Guide télédéclaration — impots.gouv.fr</h3>
                  <span className="ml-auto">
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">Espace professionnel</Badge>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    {
                      step: "1",
                      title: "Exportez votre liasse",
                      desc: "Téléchargez le PDF ci-dessus. Il contient les montants à reporter sur le formulaire officiel.",
                      icon: FileDown,
                      color: "bg-blue-100 text-blue-700",
                    },
                    {
                      step: "2",
                      title: "Connectez-vous à votre espace pro",
                      desc: "Rendez-vous sur impots.gouv.fr → Espace professionnel → saisissez votre SIREN/SIRET.",
                      icon: ExternalLink,
                      color: "bg-indigo-100 text-indigo-700",
                    },
                    {
                      step: "3",
                      title: "Déposez vos déclarations",
                      desc: "TVA : menu « Déclarer TVA » → formulaire CA3. Résultat : menu « Déclarer IS/IR » → formulaire 2050/2051.",
                      icon: Send,
                      color: "bg-violet-100 text-violet-700",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${item.color}`}>
                        {item.step}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">{item.title}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="gap-2 flex-1 sm:flex-none"
                    onClick={() => window.open("https://cfspro.impots.gouv.fr/mire/accueil.do", "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir l'espace professionnel DGFiP
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 flex-1 sm:flex-none"
                    onClick={() => window.open("https://www.impots.gouv.fr/portail/node/5028", "_blank")}
                  >
                    <Info className="w-4 h-4" />
                    Guide officiel liasse fiscale
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 flex-1 sm:flex-none"
                    onClick={exportLiassePDF}
                  >
                    <FileDown className="w-4 h-4" />
                    Télécharger le PDF
                  </Button>
                </div>
                <div className="mt-4 flex items-start gap-2 text-xs text-slate-400">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <p>
                    La déclaration EDI (dépôt automatique) nécessite un logiciel agréé DGFiP ou un expert-comptable.
                    Les boutons ci-dessus ouvrent directement les pages officielles impots.gouv.fr.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CALENDRIER FISCAL TAB ── */}
          <TabsContent value="fiscal" className="outline-none">
            <FiscalCalendar
              legalForm={companyForm.legalForm || company.legalForm || "SAS"}
              onDownloadTVA={exportTVAPDF}
              onDownloadLiasse={exportLiassePDF}
            />
          </TabsContent>

          {/* ── SETTINGS TAB ── */}
          <TabsContent value="settings" className="outline-none space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Paramètres de l'entreprise</h2>
                <p className="text-sm text-slate-500">Ces informations apparaîtront sur toutes vos factures, devis et rapports PDF.</p>
              </div>
              <div className="flex items-center gap-3">
                {settingsSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Enregistré
                  </span>
                )}
                <Button onClick={saveCompany} className="gap-2" data-testid="button-save-settings">
                  <Save className="w-4 h-4" />
                  Enregistrer
                </Button>
              </div>
            </div>

            {/* Preview card */}
            <Card className="border-primary/20 bg-primary/5 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {company.logo
                      ? <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
                      : <Building className="w-7 h-7 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900">{company.name || "Mon Entreprise"}</p>
                    <p className="text-sm text-slate-500">{[company.legalForm, company.siret ? `SIRET ${company.siret}` : ""].filter(Boolean).join(" · ") || "Forme juridique · SIRET"}</p>
                    <p className="text-sm text-slate-500">{[company.address, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Adresse non renseignée"}</p>
                    {company.email && <p className="text-sm text-slate-500">{company.email}{company.phone ? ` · ${company.phone}` : ""}</p>}
                    {company.vatNumber && <p className="text-sm text-slate-400 text-xs mt-0.5">N° TVA : {company.vatNumber}</p>}
                  </div>
                  <div className="ml-auto text-right flex-shrink-0">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Aperçu PDF</p>
                    <p className="text-xs text-slate-500 mt-1">Tel qu'il apparaît sur vos documents</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section Logo */}
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">Logo de l'entreprise</h3>
                  <span className="ml-auto text-xs text-slate-400">Affiché sur tous vos PDFs (devis, factures…)</span>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-28 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                    {companyForm.logo
                      ? <img src={companyForm.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                      : <Building className="w-8 h-8 text-slate-300" />}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">Formats acceptés : PNG, JPG, SVG. Taille recommandée : 400 × 160 px.</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {companyForm.logo ? "Changer le logo" : "Charger un logo"}
                      </Button>
                      {companyForm.logo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setCompanyForm((f) => ({ ...f, logo: "" }))}
                        >
                          <X className="w-3.5 h-3.5" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Section 1 — Identité */}
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-slate-800">Identité de l'entreprise</h3>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Raison sociale *</Label>
                    <Input
                      placeholder="Ex : Acme SAS"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      data-testid="input-company-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Forme juridique</Label>
                      <Select value={companyForm.legalForm} onValueChange={(v) => setCompanyForm({ ...companyForm, legalForm: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["EI", "EIRL", "EURL", "SARL", "SAS", "SASU", "SA", "SNC", "Auto-entrepreneur"].map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">N° SIRET</Label>
                      <Input
                        placeholder="123 456 789 00012"
                        value={companyForm.siret}
                        onChange={(e) => setCompanyForm({ ...companyForm, siret: e.target.value })}
                        data-testid="input-company-siret"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">N° TVA intracommunautaire</Label>
                    <Input
                      placeholder="FR 12 345678901"
                      value={companyForm.vatNumber}
                      onChange={(e) => setCompanyForm({ ...companyForm, vatNumber: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Section 2 — Coordonnées */}
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-slate-800">Coordonnées</h3>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Adresse</Label>
                    <Input
                      placeholder="12 rue de l'Innovation"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Code postal</Label>
                      <Input
                        placeholder="75001"
                        value={companyForm.postalCode}
                        onChange={(e) => setCompanyForm({ ...companyForm, postalCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ville</Label>
                      <Input
                        placeholder="Paris"
                        value={companyForm.city}
                        onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Téléphone</Label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="pl-9"
                          placeholder="+33 1 23 45 67 89"
                          value={companyForm.phone}
                          onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">E-mail</Label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="pl-9"
                          placeholder="contact@monentreprise.fr"
                          type="email"
                          value={companyForm.email}
                          onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Site web</Label>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="www.monentreprise.fr"
                        value={companyForm.website}
                        onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 3 — Banque */}
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Landmark className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">Informations bancaires</h3>
                  <span className="ml-auto text-xs text-slate-400">Ajouté automatiquement au pied de vos factures</span>
                </div>
                <div className="max-w-lg space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">IBAN (paiement par virement)</Label>
                  <div className="relative">
                    <CreditCard className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-9 font-mono tracking-wide"
                      placeholder="FR76 3000 6000 0112 3456 7890 189"
                      value={companyForm.iban}
                      onChange={(e) => setCompanyForm({ ...companyForm, iban: e.target.value })}
                      data-testid="input-company-iban"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    L'IBAN sera affiché dans le pied de page des PDF de factures pour faciliter le règlement par vos clients.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Mentions légales note */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
              <p>
                Ces paramètres sont sauvegardés localement dans votre session. Pour une utilisation professionnelle, vérifiez que votre SIRET,
                votre numéro de TVA et votre IBAN sont corrects — ils figureront sur les documents à valeur légale que vous transmettez à vos clients.
              </p>
            </div>
          </TabsContent>

          {/* ── IA TAB ── */}
          <TabsContent value="ia" className="outline-none">
            <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Comptable IA</h2>
                  <p className="text-sm text-slate-500">Posez vos questions fiscales et comptables — déclarations, TVA, DAS2, analyse financière…</p>
                </div>
                {aiMessages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-slate-400 hover:text-red-500 gap-1.5"
                    onClick={() => setAiMessages([])}
                  >
                    <X className="w-3.5 h-3.5" />
                    Effacer
                  </Button>
                )}
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {aiMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center max-w-sm">
                      <p className="font-semibold text-slate-800 text-lg">Votre expert-comptable IA</p>
                      <p className="text-sm text-slate-500 mt-1">Je connais vos données comptables et les règles fiscales françaises. Que puis-je faire pour vous ?</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                      {[
                        { label: "Générer la déclaration DAS2", icon: "📋" },
                        { label: "Analyser ma TVA du trimestre", icon: "🧮" },
                        { label: "Expliquer les charges déductibles", icon: "📚" },
                        { label: "Générer une déclaration CA3", icon: "📄" },
                        { label: "Analyser ma rentabilité", icon: "📈" },
                        { label: "Conseils optimisation fiscale", icon: "💡" },
                      ].map((s) => (
                        <button
                          key={s.label}
                          onClick={() => sendAiMessage(s.label)}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-violet-50 hover:border-violet-200 text-left text-sm text-slate-700 transition-colors"
                        >
                          <span className="text-lg flex-shrink-0">{s.icon}</span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-white rounded-tr-sm"
                          : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-sm"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : msg.content === "" ? (
                        <span className="inline-flex gap-1 items-center text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                        </span>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-800 prose-strong:text-slate-900 prose-code:bg-slate-200 prose-code:px-1 prose-code:rounded prose-table:text-xs">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={aiBottomRef} />
              </div>

              {/* Input bar */}
              <div className="pt-4 border-t mt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <Input
                      ref={aiInputRef}
                      placeholder="Ex : Génère la déclaration DAS2, explique la TVA sur les frais de restauration…"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendAiMessage(aiInput);
                        }
                      }}
                      disabled={aiLoading}
                      className="pr-4 py-3 h-auto"
                    />
                  </div>
                  <Button
                    onClick={() => sendAiMessage(aiInput)}
                    disabled={!aiInput.trim() || aiLoading}
                    className="h-10 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 border-0"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Envoyer</span>
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">Les réponses sont générées par IA et ne remplacent pas l'avis d'un expert-comptable agréé.</p>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {/* ── BANK CONNECTION DIALOG ── */}
      <Dialog open={showBankDialog} onOpenChange={(open) => { setShowBankDialog(open); if (!open) { setBankFormError(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Landmark className="w-5 h-5 text-primary" />
              Connecter votre banque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              Entrez vos coordonnées bancaires pour synchroniser vos transactions. La connexion est simulée — aucune donnée réelle n'est transmise.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="bank-name">Banque</Label>
              <Select value={bankForm.name} onValueChange={(v) => setBankForm({ ...bankForm, name: v })}>
                <SelectTrigger id="bank-name" data-testid="select-bank-name">
                  <SelectValue placeholder="Sélectionner votre banque…" />
                </SelectTrigger>
                <SelectContent>
                  {FRENCH_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-iban">IBAN</Label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="bank-iban"
                  className="pl-8 font-mono"
                  placeholder="FR76 1234 5678 9101 1121 3141 516"
                  value={bankForm.iban}
                  onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                  data-testid="input-bank-iban"
                />
              </div>
              <p className="text-xs text-slate-400">Format : FR76 suivi de 23 chiffres</p>
            </div>
            {bankFormError && (
              <p className="text-sm text-red-500"><span className="font-medium">Erreur :</span> {bankFormError}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBankDialog(false)} disabled={isBankConnecting}>Annuler</Button>
            <Button onClick={connectBank} className="gap-2" disabled={isBankConnecting} data-testid="button-confirm-connect-bank">
              {isBankConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {isBankConnecting ? "Connexion en cours…" : "Connecter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewClientDialog} onOpenChange={(open) => { setShowNewClientDialog(open); if (!open) { setNewClientForm(emptyClientForm); setClientFormError(""); setEditingClientIndex(null); } }}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {editingClientIndex !== null ? <Pencil className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
              {editingClientIndex !== null ? "Modifier le client" : "Nouveau client"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Identity */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Identité</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="client-name">Nom / Raison sociale <span className="text-red-500">*</span></Label>
                  <Input
                    id="client-name"
                    placeholder="ex: Garage Martin"
                    value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    data-testid="input-client-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-legal">Forme juridique</Label>
                  <Select value={newClientForm.legalForm} onValueChange={(v) => setNewClientForm({ ...newClientForm, legalForm: v })}>
                    <SelectTrigger id="client-legal" data-testid="select-client-legal">
                      <SelectValue placeholder="Sélectionner…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EI">EI — Entreprise individuelle</SelectItem>
                      <SelectItem value="EIRL">EIRL</SelectItem>
                      <SelectItem value="EURL">EURL</SelectItem>
                      <SelectItem value="SARL">SARL</SelectItem>
                      <SelectItem value="SAS">SAS</SelectItem>
                      <SelectItem value="SASU">SASU</SelectItem>
                      <SelectItem value="SA">SA</SelectItem>
                      <SelectItem value="SNC">SNC</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-siret">SIRET <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="client-siret"
                      className="pl-8"
                      placeholder="123 456 789 00012"
                      value={newClientForm.siret}
                      onChange={(e) => setNewClientForm({ ...newClientForm, siret: e.target.value })}
                      data-testid="input-client-siret"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="client-email">Email</Label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="client-email"
                      className="pl-8"
                      type="email"
                      placeholder="contact@exemple.fr"
                      value={newClientForm.email}
                      onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                      data-testid="input-client-email"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-phone">Téléphone</Label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="client-phone"
                      className="pl-8"
                      placeholder="+33 1 23 45 67 89"
                      value={newClientForm.phone}
                      onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                      data-testid="input-client-phone"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Adresse</p>
              <div className="space-y-1.5">
                <Label htmlFor="client-address">Rue</Label>
                <Input
                  id="client-address"
                  placeholder="12 rue de la Mécanique"
                  value={newClientForm.address}
                  onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
                  data-testid="input-client-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="client-postal">Code postal</Label>
                  <Input
                    id="client-postal"
                    placeholder="75011"
                    value={newClientForm.postalCode}
                    onChange={(e) => setNewClientForm({ ...newClientForm, postalCode: e.target.value })}
                    data-testid="input-client-postal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-city">Ville</Label>
                  <Input
                    id="client-city"
                    placeholder="Paris"
                    value={newClientForm.city}
                    onChange={(e) => setNewClientForm({ ...newClientForm, city: e.target.value })}
                    data-testid="input-client-city"
                  />
                </div>
              </div>
            </div>

            {clientFormError && (
              <p className="text-sm text-red-500 flex items-center gap-1.5">
                <span className="font-medium">Erreur :</span> {clientFormError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowNewClientDialog(false); setNewClientForm(emptyClientForm); setClientFormError(""); setEditingClientIndex(null); }}>
              Annuler
            </Button>
            <Button onClick={saveClient} className="gap-2" data-testid="button-save-client">
              {editingClientIndex !== null ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {editingClientIndex !== null ? "Enregistrer les modifications" : "Enregistrer le client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteClientIndex !== null} onOpenChange={(open) => { if (!open) setDeleteClientIndex(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Supprimer le client
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600">
              Vous êtes sur le point de supprimer{" "}
              <span className="font-semibold text-slate-900">
                {deleteClientIndex !== null ? clients[deleteClientIndex]?.name : ""}
              </span>.
              Cette action est irréversible.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteClientIndex(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteClient}
              className="gap-2"
              data-testid="button-confirm-delete-client"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
