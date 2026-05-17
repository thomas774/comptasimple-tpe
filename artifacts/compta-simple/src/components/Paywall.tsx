import { Check, Zap, Star, Building2, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Plan {
  key: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  recommended?: boolean;
  icon: React.ReactNode;
}

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    price: 9,
    description: "Pour micro-entrepreneurs",
    icon: <Zap className="h-5 w-5" />,
    features: [
      "Devis & factures illimités",
      "Gestion des dépenses",
      "Export PDF",
      "Dashboard CA & TVA",
      "1 utilisateur",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 19,
    description: "Pour TPE et petites entreprises",
    icon: <Star className="h-5 w-5" />,
    recommended: true,
    features: [
      "Tout Starter inclus",
      "OCR scan de reçus",
      "Import bancaire",
      "Rapports P&L PDF",
      "Déclaration TVA CA3",
      "Export comptable CSV",
      "3 utilisateurs",
    ],
  },
  {
    key: "business",
    name: "Business",
    price: 39,
    description: "Pour PME avec besoins avancés",
    icon: <Building2 className="h-5 w-5" />,
    features: [
      "Tout Pro inclus",
      "Liasse fiscale",
      "Multi-sociétés",
      "API accès",
      "Support prioritaire",
      "Utilisateurs illimités",
    ],
  },
];

interface PaywallProps {
  onCheckout: (planKey: string) => void;
  checkoutLoading: string | null;
  checkoutError: string | null;
  isUpgrade?: boolean;
  onBack?: () => void;
}

export function Paywall({
  onCheckout,
  checkoutLoading,
  checkoutError,
  isUpgrade = false,
  onBack,
}: PaywallProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="ComptaSimple" className="h-8 w-auto" />
          <span className="font-bold text-slate-900 text-lg">ComptaSimple</span>
        </div>
        {isUpgrade && onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10">
          {isUpgrade ? (
            <>
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Choisissez votre plan</h1>
              <p className="text-slate-500 text-lg max-w-lg mx-auto">
                Continuez à profiter de ComptaSimple avec un abonnement adapté à votre activité.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
                <span>⏰</span>
                Votre période d'essai est terminée
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-3">
                Choisissez votre abonnement
              </h1>
              <p className="text-slate-500 text-lg max-w-lg mx-auto">
                Sélectionnez le plan qui correspond à votre activité et continuez à gérer votre
                comptabilité simplement.
              </p>
            </>
          )}
        </div>

        {checkoutError && (
          <div className="mb-6 max-w-md w-full bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {checkoutError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl bg-white border-2 p-6 flex flex-col shadow-sm transition-shadow hover:shadow-md ${
                plan.recommended
                  ? "border-blue-500 shadow-blue-100"
                  : "border-slate-200"
              }`}
            >
              {plan.recommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-0.5 text-xs">
                  Recommandé
                </Badge>
              )}

              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 ${
                  plan.recommended
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {plan.icon}
              </div>

              <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
              <p className="text-slate-500 text-sm mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-slate-900">{plan.price}€</span>
                <span className="text-slate-400 text-sm">/mois HT</span>
              </div>

              <ul className="flex-1 space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check
                      className={`h-4 w-4 mt-0.5 shrink-0 ${plan.recommended ? "text-blue-600" : "text-emerald-500"}`}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => onCheckout(plan.key)}
                disabled={checkoutLoading !== null}
                className={`w-full font-semibold ${
                  plan.recommended
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                {checkoutLoading === plan.key ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirection…
                  </>
                ) : (
                  `Choisir ${plan.name}`
                )}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-slate-400 text-center">
          Paiement sécurisé par Stripe · Résiliation à tout moment · Sans engagement
        </p>
      </main>
    </div>
  );
}
