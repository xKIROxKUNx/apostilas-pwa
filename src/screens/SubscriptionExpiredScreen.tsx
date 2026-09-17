import { useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { useApostilas } from "@/state/ApostilasContext";
import { Button, Card, Spinner } from "@/components";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Lock } from "@/components/icons";

const NUMERO_WHATSAPP = import.meta.env.VITE_WHATSAPP_ADMIN ?? "";

export default function SubscriptionExpiredScreen() {
  const { user, endSession } = useAuth();
  const { refresh, loading } = useApostilas();
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ocupado = verificando || loading;

  async function verificar() {
    setVerificando(true);
    setErro(null);
    try {
      await user?.getIdToken(true);
      refresh();
    } catch {
      setErro("Sua sessão expirou. Entre novamente.");
    } finally {
      setVerificando(false);
    }
  }

  const linkWhatsapp = NUMERO_WHATSAPP
    ? `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(
        `Olá! Quero renovar minha assinatura das apostilas. Minha conta: ${user?.email ?? ""}`,
      )}`
    : null;

  return (
    <div style={styles.page}>
      <div style={styles.themeCorner}>
        <ThemeToggle />
      </div>

      <Card radius="xl" style={styles.card}>
        <div style={styles.content}>
          <div style={styles.badge}>
            <Lock size={28} />
          </div>

          <h1 className="m3-headline-small" style={styles.title}>
            Assinatura encerrada
          </h1>

          <p className="m3-body-medium" style={styles.body}>
            Seu acesso às apostilas está suspenso porque a assinatura venceu. Renove com o
            administrador para voltar a estudar.
          </p>

          {linkWhatsapp && (
            <a href={linkWhatsapp} target="_blank" rel="noreferrer" style={styles.link}>
              <Button fullWidth>Falar com o administrador</Button>
            </a>
          )}

          <Button variant="tonal" fullWidth disabled={ocupado} onClick={verificar}>
            {ocupado ? <Spinner size={20} /> : null}
            {ocupado ? "Verificando…" : "Já renovei"}
          </Button>

          {erro && (
            <p className="m3-body-small" style={styles.erro} role="alert">
              {erro}
            </p>
          )}

          <Button variant="text" fullWidth onClick={endSession}>
            Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--md-surface)",
    padding: 24,
  },
  themeCorner: {
    position: "fixed",
    top: `calc(8px + env(safe-area-inset-top, 0px))`,
    right: 8,
    display: "flex",
    alignItems: "center",
  },
  card: { width: "100%", maxWidth: 400 },
  content: { display: "flex", flexDirection: "column", gap: 12, padding: 28, textAlign: "center" },
  badge: {
    alignSelf: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "var(--md-error-container)",
    color: "var(--md-on-error-container)",
    marginBottom: 4,
  },
  title: { margin: 0 },
  body: { color: "var(--md-on-surface-variant)", margin: "0 0 8px" },
  link: { textDecoration: "none", display: "block" },
  erro: { color: "var(--md-error)", margin: 0 },
};
