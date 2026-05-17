import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, ExternalLink, CheckCircle2, AlertCircle, Clock,
  CalendarDays, Upload, ChevronDown, ChevronUp, FileText,
  Info, Building2, AlertTriangle, Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeclCategory = "tva" | "is" | "ir" | "social" | "local";

type DeclarationStatus = "filed" | "overdue" | "urgent" | "coming";

interface FiscalDecl {
  id: string;
  name: string;
  shortName: string;
  description: string;
  form: string;
  category: DeclCategory;
  dueDateISO: string;
  periodLabel: string;
  applicableForms: string[];
  canDownload: boolean;
  downloadLabel: string;
  impotUrl: string;
  impotLabel: string;
  notes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function computeStatus(dueDateISO: string, filed: boolean): DeclarationStatus {
  if (filed) return "filed";
  const due = new Date(dueDateISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "urgent";
  return "coming";
}

function daysLabel(dueDateISO: string) {
  const due = new Date(dueDateISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  if (diffDays < 0) return `${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? "s" : ""} de retard`;
  return `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
}

// ── Declaration Catalogue ─────────────────────────────────────────────────────
// Full 2026 fiscal calendar for French TPE/PME

const LEGAL_FORMS_IS = ["SAS", "SARL", "SA", "SCA", "SNC (IS)", "SCI (IS)", "SASU"];
const LEGAL_FORMS_IR = ["EI", "EURL (IR)", "SNC (IR)", "SCI (IR)", "SELARL (IR)", "Auto-entrepreneur"];
const LEGAL_FORMS_TVA = ["SAS", "SARL", "SA", "SASU", "EI", "EURL", "SNC", "SCI", "Auto-entrepreneur (CA > 36 800 €)"];
const LEGAL_FORMS_ALL = ["SAS", "SARL", "SA", "SASU", "EI", "EURL", "SNC", "SCI", "Auto-entrepreneur"];

function buildDeclarations(): FiscalDecl[] {
  const decls: FiscalDecl[] = [];

  // ── TVA CA3 mensuelles 2026 ──────────────────────────────────────────────
  const tvaMonths = [
    { period: "Janvier 2026", due: "2026-02-24", id: "tva-jan-26" },
    { period: "Février 2026", due: "2026-03-24", id: "tva-feb-26" },
    { period: "Mars 2026", due: "2026-04-24", id: "tva-mar-26" },
    { period: "Avril 2026", due: "2026-05-24", id: "tva-apr-26" },
    { period: "Mai 2026", due: "2026-06-24", id: "tva-may-26" },
    { period: "Juin 2026", due: "2026-07-24", id: "tva-jun-26" },
    { period: "Juillet 2026", due: "2026-08-24", id: "tva-jul-26" },
    { period: "Août 2026", due: "2026-09-24", id: "tva-aug-26" },
    { period: "Septembre 2026", due: "2026-10-24", id: "tva-sep-26" },
    { period: "Octobre 2026", due: "2026-11-24", id: "tva-oct-26" },
    { period: "Novembre 2026", due: "2026-12-24", id: "tva-nov-26" },
    { period: "Décembre 2026", due: "2027-01-24", id: "tva-dec-26" },
  ];
  for (const m of tvaMonths) {
    decls.push({
      id: m.id,
      name: "Déclaration TVA mensuelle — CA3",
      shortName: "TVA CA3",
      description: "Déclaration mensuelle de TVA (régime réel normal). Calcul : TVA collectée sur ventes − TVA déductible sur achats.",
      form: "CA3",
      category: "tva",
      dueDateISO: m.due,
      periodLabel: m.period,
      applicableForms: LEGAL_FORMS_TVA,
      canDownload: true,
      downloadLabel: "Exporter CA3 PDF",
      impotUrl: "https://cfspro.impots.gouv.fr/mire/accueil.do",
      impotLabel: "Déposer sur impots.gouv.fr",
      notes: "Dépôt en ligne obligatoire (espace professionnel DGFiP). Délai : le 24 du mois suivant la période.",
    });
  }

  // ── TVA CA12 annuelle (régime simplifié) ──────────────────────────────────
  decls.push({
    id: "tva-ca12-2025",
    name: "Déclaration TVA annuelle — CA12",
    shortName: "TVA CA12",
    description: "Déclaration annuelle de TVA pour les entreprises sous régime simplifié d'imposition (RSI). Solde de TVA + 2 acomptes en juillet et décembre.",
    form: "CA12",
    category: "tva",
    dueDateISO: "2026-05-05",
    periodLabel: "Exercice 2025",
    applicableForms: ["SAS (RSI)", "SARL (RSI)", "EI (RSI)", "EURL (RSI)", "SNC (RSI)"],
    canDownload: false,
    downloadLabel: "",
    impotUrl: "https://cfspro.impots.gouv.fr/mire/accueil.do",
    impotLabel: "Déposer sur impots.gouv.fr",
    notes: "Applicable uniquement aux entreprises dont le CA HT est compris entre 36 800 € et 254 000 € (services) ou 91 900 € et 840 000 € (ventes).",
  });

  // ── IS — Acomptes trimestriels 2026 ───────────────────────────────────────
  const isAcomptes = [
    { id: "is-acompte-t1-26", period: "T1 2026 (basé sur IS 2024)", due: "2026-03-15", num: 1 },
    { id: "is-acompte-t2-26", period: "T2 2026 (basé sur IS 2024)", due: "2026-06-15", num: 2 },
    { id: "is-acompte-t3-26", period: "T3 2026 (basé sur IS 2024)", due: "2026-09-15", num: 3 },
    { id: "is-acompte-t4-26", period: "T4 2026 (basé sur IS 2024)", due: "2026-12-15", num: 4 },
  ];
  for (const a of isAcomptes) {
    decls.push({
      id: a.id,
      name: `Acompte IS — ${a.num}ème trimestre`,
      shortName: `Acompte IS T${a.num}`,
      description: `${a.num}ème acompte provisionnel d'Impôt sur les Sociétés. Chaque acompte = 25 % de l'IS de référence (N-1 ou N-2). Non dû si IS < 3 000 €.`,
      form: "2571",
      category: "is",
      dueDateISO: a.due,
      periodLabel: a.period,
      applicableForms: LEGAL_FORMS_IS,
      canDownload: false,
      downloadLabel: "",
      impotUrl: "https://cfspro.impots.gouv.fr/mire/accueil.do",
      impotLabel: "Payer sur impots.gouv.fr",
      notes: "Paiement en ligne obligatoire via l'espace professionnel DGFiP (formulaire 2571).",
    });
  }

  // ── IS — Solde et liasse fiscale exercice 2025 ────────────────────────────
  decls.push({
    id: "is-solde-2025",
    name: "Solde IS — Exercice 2025",
    shortName: "IS solde 2025",
    description: "Paiement du solde de l'Impôt sur les Sociétés pour l'exercice clos le 31/12/2025 (IS total dû − acomptes versés). Formulaire 2572.",
    form: "2572",
    category: "is",
    dueDateISO: "2026-04-15",
    periodLabel: "Exercice 2025 (FY 31/12)",
    applicableForms: LEGAL_FORMS_IS,
    canDownload: false,
    downloadLabel: "",
    impotUrl: "https://cfspro.impots.gouv.fr/mire/accueil.do",
    impotLabel: "Payer sur impots.gouv.fr",
    notes: "Délai : le 15 du 4ème mois suivant la clôture (15 avril pour exercice 31/12). Pour IS < 3 000 €, aucun acompte requis.",
  });

  // ── Liasse fiscale IS 2025 ────────────────────────────────────────────────
  decls.push({
    id: "liasse-is-2025",
    name: "Liasse fiscale IS — Exercice 2025",
    shortName: "Liasse IS 2025",
    description: "Dépôt de la liasse fiscale IS : bilan (2050), compte de résultat (2051), annexes (2052/2053), déclaration de résultats IS (2065). Dépôt EDI obligatoire via expert-comptable ou logiciel agréé.",
    form: "2065 / 2050 / 2051",
    category: "is",
    dueDateISO: "2026-05-05",
    periodLabel: "Exercice 2025",
    applicableForms: LEGAL_FORMS_IS,
    canDownload: true,
    downloadLabel: "Télécharger liasse PDF",
    impotUrl: "https://cfspro.impots.gouv.fr/mire/accueil.do",
    impotLabel: "Déposer via EDI / impots.gouv.fr",
    notes: "Le PDF est indicatif — le dépôt officiel doit se faire par EDI (DGFiP) ou via l'espace professionnel impots.gouv.fr.",
  });

  // ── Liasse IR / BIC 2031 (exercice 2025) ─────────────────────────────────
  decls.push({
    id: "liasse-ir-bic-2025",
    name: "Déclaration de résultats BIC — Exercice 2025",
    shortName: "BIC 2031",
    description: "Déclaration des résultats d'exploitation pour les entreprises soumises à l'IR dans la catégorie Bénéfices Industriels et Commerciaux. Formulaire 2031 + annexes.",
    form: "2031",
    category: "ir",
    dueDateISO: "2026-05-18",
    periodLabel: "Exercice 2025",
    applicableForms: LEGAL_FORMS_IR,
    canDownload: false,
    downloadLabel: "",
    impotUrl: "https://www.impots.gouv.fr/professionnel/les-declarations",
    impotLabel: "Déposer sur impots.gouv.fr",
    notes: "Pour les professions libérales (BNC), utiliser le formulaire 2035 avec la même échéance.",
  });

  // ── IR personnel 2042 ────────────────────────────────────────────────────
  decls.push({
    id: "ir-2042-2025",
    name: "Déclaration IR personnelle 2025",
    shortName: "IR 2042",
    description: "Déclaration annuelle de revenus personnels. Pour les dirigeants d'entreprise soumis à l'IR : inclut les revenus professionnels (rémunération, dividendes, résultats).",
    form: "2042",
    category: "ir",
    dueDateISO: "2026-06-08",
    periodLabel: "Revenus 2025",
    applicableForms: ["EI", "EURL (IR)", "Gérant SARL (IS)", "Associé SNC", "Gérant SAS"],
    canDownload: false,
    downloadLabel: "",
    impotUrl: "https://www.impots.gouv.fr/particulier/declarer-mes-revenus",
    impotLabel: "Déclarer sur impots.gouv.fr",
    notes: "Délai variable selon le département (fin mai à mi-juin). Vérifiez votre calendrier sur impots.gouv.fr.",
  });

  // ── CFE ───────────────────────────────────────────────────────────────────
  decls.push({
    id: "cfe-2026",
    name: "Cotisation Foncière des Entreprises — 2026",
    shortName: "CFE 2026",
    description: "Taxe locale due par toutes les entreprises exerçant une activité professionnelle non salariée (sauf exonérations). Calculée sur la valeur locative des locaux professionnels.",
    form: "CFE",
    category: "local",
    dueDateISO: "2026-12-15",
    periodLabel: "Année 2026",
    applicableForms: LEGAL_FORMS_ALL,
    canDownload: false,
    downloadLabel: "",
    impotUrl: "https://cfspro.impots.gouv.fr/mire/accueil.do",
    impotLabel: "Payer sur impots.gouv.fr",
    notes: "Acompte possible si CFE > 3 000 € (échéance 15 juin). Exonération la première année d'activité.",
  });

  // ── URSSAF / Cotisations sociales TNS ────────────────────────────────────
  const urssafEcheances = [
    { id: "urssaf-q1-26", period: "T1 2026", due: "2026-01-31" },
    { id: "urssaf-q2-26", period: "T2 2026", due: "2026-04-30" },
    { id: "urssaf-q3-26", period: "T3 2026", due: "2026-07-31" },
    { id: "urssaf-q4-26", period: "T4 2026", due: "2026-10-31" },
  ];
  for (const u of urssafEcheances) {
    decls.push({
      id: u.id,
      name: "Cotisations sociales URSSAF (TNS)",
      shortName: `URSSAF ${u.period}`,
      description: "Cotisations sociales obligatoires des Travailleurs Non Salariés (gérant majoritaire, EI, auto-entrepreneur). Calcul sur la base des revenus professionnels N-2 provisionnels.",
      form: "DSI",
      category: "social",
      dueDateISO: u.due,
      periodLabel: u.period,
      applicableForms: ["EI", "EURL", "Gérant majoritaire SARL", "Auto-entrepreneur", "SNC"],
      canDownload: false,
      downloadLabel: "",
      impotUrl: "https://www.urssaf.fr/portail/home/independants.html",
      impotLabel: "Payer sur urssaf.fr",
      notes: "Option mensuelle disponible. Auto-entrepreneurs : déclaration et paiement mensuel ou trimestriel sur autoentrepreneur.urssaf.fr.",
    });
  }

  // ── DAS2 (honoraires, commissions) ───────────────────────────────────────
  decls.push({
    id: "das2-2025",
    name: "DAS2 — Honoraires et commissions versés",
    shortName: "DAS2",
    description: "Déclaration des honoraires, commissions, courtages, ristournes et autres rémunérations versés à des tiers (experts, sous-traitants, consultants) en 2025. Obligatoire si montants ≥ 1 200 €/an par bénéficiaire.",
    form: "DAS2",
    category: "is",
    dueDateISO: "2026-01-31",
    periodLabel: "Exercice 2025",
    applicableForms: LEGAL_FORMS_ALL,
    canDownload: false,
    downloadLabel: "",
    impotUrl: "https://cfspro.impots.gouv.fr/mire/accueil.do",
    impotLabel: "Déposer sur impots.gouv.fr",
    notes: "Dépôt en même temps que la liasse fiscale pour les sociétés IS. Pour IR, délai au 31 janvier N+1.",
  });

  // Sort by due date ascending
  decls.sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO));
  return decls;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DeclCategory, string> = {
  tva: "TVA",
  is: "Impôt Sociétés",
  ir: "Impôt Revenus",
  social: "Social / URSSAF",
  local: "Taxes locales",
};

const CATEGORY_COLORS: Record<DeclCategory, string> = {
  tva: "bg-blue-100 text-blue-700 border-blue-200",
  is: "bg-violet-100 text-violet-700 border-violet-200",
  ir: "bg-amber-100 text-amber-700 border-amber-200",
  social: "bg-emerald-100 text-emerald-700 border-emerald-200",
  local: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_CONFIG: Record<DeclarationStatus, {
  label: string; icon: typeof CheckCircle2; bg: string; text: string; border: string;
}> = {
  filed: {
    label: "Déposée", icon: CheckCircle2,
    bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",
  },
  overdue: {
    label: "En retard", icon: AlertCircle,
    bg: "bg-red-50", text: "text-red-700", border: "border-red-200",
  },
  urgent: {
    label: "Urgent", icon: AlertTriangle,
    bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200",
  },
  coming: {
    label: "À venir", icon: Clock,
    bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200",
  },
};

const ALL_LEGAL_FORMS = [
  "SAS", "SARL", "SA", "SASU", "EI", "EURL", "SNC", "SCI", "Auto-entrepreneur",
];

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

// ── Props ─────────────────────────────────────────────────────────────────────

interface FiscalCalendarProps {
  legalForm: string;
  onDownloadTVA: () => void;
  onDownloadLiasse: () => void;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FiscalCalendar({ legalForm, onDownloadTVA, onDownloadLiasse }: FiscalCalendarProps) {
  const allDecls = useMemo(() => buildDeclarations(), []);

  const [filedIds, setFiledIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("fiscal_filed_2026");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<DeclCategory | "all">("all");
  const [filterLegalForm, setFilterLegalForm] = useState<string>("all");
  const [showOnlyApplicable, setShowOnlyApplicable] = useState(true);

  const toggleFiled = (id: string) => {
    setFiledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("fiscal_filed_2026", JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  };

  const activeLegalForm = filterLegalForm !== "all" ? filterLegalForm : legalForm;

  const filtered = useMemo(() => {
    return allDecls.filter((d) => {
      if (filterCategory !== "all" && d.category !== filterCategory) return false;
      if (showOnlyApplicable && activeLegalForm) {
        const base = activeLegalForm.split(" ")[0].toUpperCase();
        const applies = d.applicableForms.some((f) => f.toUpperCase().startsWith(base) || f.toUpperCase() === activeLegalForm.toUpperCase());
        if (!applies) return false;
      }
      return true;
    });
  }, [allDecls, filterCategory, showOnlyApplicable, activeLegalForm]);

  // Group declarations by month for the timeline
  const byMonth = useMemo(() => {
    const map: Record<number, typeof filtered> = {};
    for (const d of filtered) {
      const m = new Date(d.dueDateISO).getMonth();
      if (!map[m]) map[m] = [];
      map[m].push(d);
    }
    return map;
  }, [filtered]);

  const today = new Date();
  const currentMonth = today.getMonth();

  // Summary stats
  const stats = useMemo(() => {
    const relevant = filtered.map((d) => ({ ...d, status: computeStatus(d.dueDateISO, filedIds.has(d.id)) }));
    return {
      total: relevant.length,
      filed: relevant.filter((d) => d.status === "filed").length,
      overdue: relevant.filter((d) => d.status === "overdue").length,
      urgent: relevant.filter((d) => d.status === "urgent").length,
    };
  }, [filtered, filedIds]);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Calendrier Fiscal 2026</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Toutes vos obligations fiscales et sociales — téléchargez, suivez et déposez chaque déclaration.
          </p>
        </div>
        <a
          href="https://cfspro.impots.gouv.fr/mire/accueil.do"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" className="gap-2 text-sm">
            <ExternalLink className="w-4 h-4" />
            Espace professionnel DGFiP
          </Button>
        </a>
      </div>

      {/* ── Summary KPIs ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total déclarations", value: stats.total, color: "text-slate-800", bg: "bg-slate-50", border: "border-slate-200" },
          { label: "Déposées", value: stats.filed, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
          { label: "En retard", value: stats.overdue, color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
          { label: "Urgentes (≤ 14 j)", value: stats.urgent, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
        ].map((s) => (
          <Card key={s.label} className={`shadow-sm border ${s.border} ${s.bg}`}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Timeline strip ─────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Chronologie 2026</h3>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {MONTHS_FR.map((label, idx) => {
              const monthDecls = byMonth[idx] ?? [];
              const statuses = monthDecls.map((d) => computeStatus(d.dueDateISO, filedIds.has(d.id)));
              const hasOverdue = statuses.some((s) => s === "overdue");
              const hasUrgent = statuses.some((s) => s === "urgent");
              const allFiled = monthDecls.length > 0 && statuses.every((s) => s === "filed");
              const isPast = idx < currentMonth;
              const isCurrent = idx === currentMonth;

              let dotColor = "bg-slate-200";
              if (monthDecls.length > 0) {
                if (allFiled) dotColor = "bg-emerald-400";
                else if (hasOverdue) dotColor = "bg-red-500";
                else if (hasUrgent) dotColor = "bg-amber-400";
                else dotColor = "bg-blue-400";
              }

              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center gap-1.5 min-w-[52px] rounded-xl p-2 cursor-default transition-colors
                    ${isCurrent ? "bg-blue-50 border border-blue-200" : isPast ? "bg-slate-50" : "bg-white"}`}
                >
                  <span className={`text-xs font-medium ${isCurrent ? "text-blue-700 font-bold" : "text-slate-500"}`}>
                    {label}
                  </span>
                  {monthDecls.length > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                      <span className="text-[10px] text-slate-400 font-medium">{monthDecls.length}</span>
                    </div>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-xs text-slate-500">
            {[
              { dot: "bg-red-500", label: "En retard" },
              { dot: "bg-amber-400", label: "Urgent" },
              { dot: "bg-blue-400", label: "À venir" },
              { dot: "bg-emerald-400", label: "Déposée" },
              { dot: "bg-slate-200", label: "Aucune" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${l.dot}`} />
                {l.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-600">Filtres :</span>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1.5">
              {(["all", "tva", "is", "ir", "social", "local"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                    ${filterCategory === c
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
                >
                  {c === "all" ? "Toutes catégories" : CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Legal form selector */}
              <select
                value={filterLegalForm}
                onChange={(e) => setFilterLegalForm(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="all">Forme juridique : {legalForm || "Toutes"}</option>
                {ALL_LEGAL_FORMS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {/* Applicable toggle */}
              <button
                onClick={() => setShowOnlyApplicable((v) => !v)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors
                  ${showOnlyApplicable
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
              >
                {showOnlyApplicable ? "✓ Applicable uniquement" : "Toutes les déclarations"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Declarations List ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            Aucune déclaration ne correspond aux filtres sélectionnés.
          </div>
        )}

        {filtered.map((decl) => {
          const isFiled = filedIds.has(decl.id);
          const status = computeStatus(decl.dueDateISO, isFiled);
          const cfg = STATUS_CONFIG[status];
          const StatusIcon = cfg.icon;
          const isExpanded = expandedId === decl.id;
          const isTVA = decl.id.startsWith("tva-") && !decl.id.includes("ca12");
          const isLiasse = decl.id === "liasse-is-2025";

          return (
            <Card
              key={decl.id}
              className={`shadow-sm border transition-all ${isFiled ? "opacity-70" : ""} ${status === "overdue" ? "border-red-200" : status === "urgent" ? "border-amber-200" : "border-slate-200"}`}
            >
              <CardContent className="p-0">
                {/* Main row */}
                <div className="flex items-start gap-3 p-4">
                  {/* Status icon */}
                  <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${cfg.bg}`}>
                    <StatusIcon className={`w-4 h-4 ${cfg.text}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900 leading-tight">{decl.name}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${CATEGORY_COLORS[decl.category]}`}>
                        {CATEGORY_LABELS[decl.category]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-200 text-slate-500">
                        {decl.form}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-500 mb-2">{decl.periodLabel}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {/* Due date */}
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-600 font-medium">
                          Échéance : {fmtDate(decl.dueDateISO)}
                        </span>
                      </div>
                      {/* Days label */}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {daysLabel(decl.dueDateISO)}
                      </span>
                    </div>

                    {/* Legal forms */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Building2 className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                      {decl.applicableForms.slice(0, 6).map((f) => (
                        <span
                          key={f}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none
                            ${(filterLegalForm !== "all" ? filterLegalForm : legalForm)?.toUpperCase().startsWith(f.split(" ")[0].toUpperCase())
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-slate-50 text-slate-500 border-slate-200"}`}
                        >
                          {f}
                        </span>
                      ))}
                      {decl.applicableForms.length > 6 && (
                        <span className="text-[10px] text-slate-400 italic">+{decl.applicableForms.length - 6}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Filed toggle */}
                    <button
                      onClick={() => toggleFiled(decl.id)}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1
                        ${isFiled
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
                          : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600"}`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {isFiled ? "Déposée" : "Marquer déposée"}
                    </button>

                    {/* Expand */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : decl.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? "Réduire" : "Détails"}
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t bg-slate-50/60 p-4 space-y-4 rounded-b-lg">
                    {/* Description */}
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600 leading-relaxed">{decl.description}</p>
                    </div>

                    {decl.notes && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700 leading-relaxed">{decl.notes}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {decl.canDownload && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-xs"
                          onClick={isTVA ? onDownloadTVA : isLiasse ? onDownloadLiasse : undefined}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {decl.downloadLabel}
                        </Button>
                      )}

                      <a href={decl.impotUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 text-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {decl.impotLabel}
                        </Button>
                      </a>

                      <Button
                        size="sm"
                        variant="outline"
                        className={`gap-1.5 h-8 text-xs ml-auto ${isFiled ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" : ""}`}
                        onClick={() => toggleFiled(decl.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isFiled ? "Annuler — non déposée" : "Marquer comme déposée"}
                      </Button>
                    </div>

                    {/* All applicable legal forms expanded */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                        Formes juridiques concernées
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {decl.applicableForms.map((f) => (
                          <span
                            key={f}
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none
                              ${(filterLegalForm !== "all" ? filterLegalForm : legalForm)?.toUpperCase().startsWith(f.split(" ")[0].toUpperCase())
                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                : "bg-white text-slate-500 border-slate-200"}`}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
        <p>
          Ce calendrier est fourni à titre indicatif. Les dates peuvent varier selon votre régime fiscal, votre date de clôture d'exercice et votre département.
          Consultez votre expert-comptable ou vérifiez les échéances officielles sur{" "}
          <a href="https://www.impots.gouv.fr" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-700">
            impots.gouv.fr
          </a>.
        </p>
      </div>
    </div>
  );
}
