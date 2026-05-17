import { useState } from "react";
import { Clock, X, Zap } from "lucide-react";

interface TrialBannerProps {
  daysRemaining: number;
  onUpgrade: () => void;
}

export function TrialBanner({ daysRemaining, onUpgrade }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isUrgent = daysRemaining <= 2;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${
        isUrgent
          ? "bg-gradient-to-r from-red-600 to-red-700"
          : "bg-gradient-to-r from-blue-600 to-blue-700"
      } text-white`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {daysRemaining === 0
            ? "Votre essai expire aujourd'hui."
            : `${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} d'essai restant${daysRemaining > 1 ? "s" : ""}.`}
          &nbsp;
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline font-semibold"
          >
            <Zap className="h-3.5 w-3.5" />
            Passer à un abonnement
          </button>
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-4 shrink-0 hover:opacity-75 transition-opacity"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
