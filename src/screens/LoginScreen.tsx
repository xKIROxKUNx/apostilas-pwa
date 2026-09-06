import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { toFriendlyMessage } from "@/firebase/errorMessages";
import { Button, Card, IconButton, Spinner, TextField } from "@/components";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RefreshButton } from "@/components/RefreshButton";
import { Visibility, VisibilityOff } from "@/components/icons";

export default function LoginScreen() {
  const { login, blockedMessage, consumeBlockedMessage, savedNickname } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (blockedMessage) {
      setErrorMsg(blockedMessage);
      consumeBlockedMessage();
    }
  }, [blockedMessage, consumeBlockedMessage]);

  useEffect(() => {
    if (!nickname && savedNickname) setNickname(savedNickname);
  }, [savedNickname, nickname]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailComErro = email.length > 0 && !emailValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!nickname.trim() || !email.trim() || !password) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }
    if (!emailValid) {
      setErrorMsg("Digite um e-mail válido.");
      return;
    }
    if (!navigator.onLine) {
      setErrorMsg("Sem conexão com a internet. Verifique sua rede.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password, nickname);
      navigate("/home", { replace: true });
    } catch (err) {
      setErrorMsg(toFriendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.themeCorner}>
        <RefreshButton />
        <ThemeToggle />
      </div>

      <Card radius="xl" style={styles.card}>
        <form style={styles.form} onSubmit={handleSubmit}>
          <h1 className="m3-headline-medium" style={{ color: "var(--md-primary)" }}>
            Bem-vindo(a)
          </h1>
          <p className="m3-body-medium" style={styles.subtitle}>
            Identifique-se para acessar as apostilas
          </p>

          <TextField
            label="Apelido"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="nickname"
            supportingText="Como deseja ser chamado?"
          />

          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            error={emailComErro}
            supportingText={emailComErro ? "E-mail inválido" : undefined}
          />

          <TextField
            label="Senha"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            trailing={
              <IconButton
                type="button"
                label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <VisibilityOff size={20} /> : <Visibility size={20} />}
              </IconButton>
            }
          />

          {errorMsg && (
            <p className="m3-body-small" style={styles.error} role="alert">
              {errorMsg}
            </p>
          )}

          <Button type="submit" fullWidth disabled={loading} style={styles.submit}>
            {loading ? <Spinner size={20} /> : null}
            {loading ? "Entrando…" : "Entrar"}
          </Button>

          <Button
            type="button"
            variant="text"
            fullWidth
            onClick={() => setErrorMsg("Recuperação de senha em breve.")}
          >
            Esqueceu a senha?
          </Button>
        </form>
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
  form: { display: "flex", flexDirection: "column", gap: 20, padding: 28 },
  subtitle: { color: "var(--md-on-surface-variant)", marginTop: -12 },
  error: { color: "var(--md-error)", textAlign: "center" },
  submit: { marginTop: 4 },
};
