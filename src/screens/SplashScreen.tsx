import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { Spinner } from "@/components";

export default function SplashScreen() {
  const { sessionState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionState === "checking") return;
    navigate(sessionState === "valid" ? "/home" : "/login", { replace: true });
  }, [sessionState, navigate]);

  return (
    <div style={styles.page}>
      <h1 className="m3-headline-medium" style={{ color: "var(--md-primary)" }}>
        Apostilas
      </h1>
      <Spinner size={28} label="Carregando" />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    background: "var(--md-surface)",
  },
};
