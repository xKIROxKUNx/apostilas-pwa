import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { TelaCarregando } from "@/components/TelaCarregando";

export default function SplashScreen() {
  const { sessionState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionState === "checking") return;
    navigate(sessionState === "valid" ? "/home" : "/login", { replace: true });
  }, [sessionState, navigate]);

  return <TelaCarregando texto="Carregando…" />;
}
