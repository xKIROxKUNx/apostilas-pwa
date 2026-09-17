import { useEffect, useState } from "react";
import { useApostilas } from "@/state/ApostilasContext";
import { msAteExpirar, subscriptionStatus, type SubscriptionStatus } from "@/types/subscription";

export function useSubscription(): SubscriptionStatus {
  const { userProfile } = useApostilas();
  const expiraEm = userProfile?.assinaturaExpiraEm ?? null;
  const nivelAcesso = userProfile?.nivelAcesso ?? 0;
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!expiraEm) return;

    const marcar = () => setAgora(new Date());
    const restante = msAteExpirar(expiraEm, new Date());
    const timer = restante > 0 ? window.setTimeout(marcar, restante) : undefined;
    document.addEventListener("visibilitychange", marcar);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", marcar);
    };
  }, [expiraEm, agora]);

  return subscriptionStatus(expiraEm, agora, nivelAcesso);
}
