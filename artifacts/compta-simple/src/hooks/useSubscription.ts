import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/react";

export type SubscriptionStatus =
  | "loading"
  | "trial"
  | "active"
  | "expired"
  | "error";

export type SubscriptionData = {
  status: SubscriptionStatus;
  daysRemaining: number | null;
  plan: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export function useSubscription() {
  const { isSignedIn, isLoaded } = useUser();
  const [data, setData] = useState<SubscriptionData>({
    status: "loading",
    daysRemaining: null,
    plan: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
  });
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription/status", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur serveur");
      const json = await res.json();
      setData(json);
    } catch {
      setData((prev) => ({ ...prev, status: "error" }));
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetchStatus();
  }, [isLoaded, isSignedIn, fetchStatus]);

  const startCheckout = useCallback(async (planKey: string) => {
    setCheckoutLoading(planKey);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur paiement");
      window.location.href = json.url;
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : "Erreur inconnue");
      setCheckoutLoading(null);
    }
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription/portal", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = json.url;
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur portail");
    }
  }, []);

  return { data, fetchStatus, startCheckout, openPortal, checkoutLoading, checkoutError };
}
