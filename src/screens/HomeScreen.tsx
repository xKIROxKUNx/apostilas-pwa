import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useApostilas } from "@/state/ApostilasContext";
import { hasAccess, toRoleName, type Apostila } from "@/types/domain";
import { canOpenApostilaAnyDevice } from "@/security/wasm/accessGuard";
import { getOrCreateDeviceId } from "@/security/deviceId";
import { toFriendlyMessage } from "@/firebase/errorMessages";
import { Button, Card, IconButton, Snackbar, Spinner } from "@/components";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RefreshButton } from "@/components/RefreshButton";
import {
  ExpandLess,
  ExpandMore,
  KeyboardArrowRight,
  Lock,
  Logout,
} from "@/components/icons";

const CORES_MATERIA = [
  "var(--md-materia1)",
  "var(--md-materia2)",
  "var(--md-materia3)",
  "var(--md-materia4)",
  "var(--md-materia5)",
];

export default function HomeScreen() {
  const { logout, savedNickname, user } = useAuth();
  const { userProfile, apostilas, loading, error, refresh } = useApostilas();
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Apostila[]>();
    for (const a of apostilas) {
      const list = map.get(a.componenteCurricular) ?? [];
      list.push(a);
      map.set(a.componenteCurricular, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [apostilas]);

  const userLevel = userProfile?.nivelAcesso ?? 0;
  const displayName = savedNickname || user?.email || "Estudante";

  async function handleOpen(apostila: Apostila) {
    const deviceId = await getOrCreateDeviceId();
    const allowed = canOpenApostilaAnyDevice(
      userLevel,
      apostila.nivelRequerido,
      deviceId,
      userProfile?.deviceIds ?? [],
    );
    if (!allowed) {
      setToast(
        hasAccess(userLevel, apostila.nivelRequerido)
          ? "Este dispositivo não corresponde ao vinculado à sua conta."
          : "Upgrade necessário para acessar este conteúdo.",
      );
      setTimeout(() => setToast(null), 3000);
      return;
    }
    navigate(`/apostila/${apostila.id}`);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 className="m3-headline-small">Apostilas</h1>
        <div style={{ display: "flex", alignItems: "center" }}>
          <RefreshButton />
          <ThemeToggle />
          <IconButton label="Sair" onClick={logout}>
            <Logout />
          </IconButton>
        </div>
      </header>

      <Card variant="primary" radius="xl" style={styles.welcome}>
        <p className="m3-headline-small">Olá, {displayName}</p>
        {userProfile && (
          <p className="m3-body-large" style={styles.assinatura}>
            Assinatura: {toRoleName(userProfile.nivelAcesso)}
          </p>
        )}
        <p className="m3-body-medium" style={styles.welcomeHint}>
          Escolha um componente curricular para começar
        </p>
      </Card>

      {loading && (
        <div style={styles.centerMsg}>
          <Spinner label="Carregando apostilas" />
        </div>
      )}

      {error && (
        <div style={styles.centerMsg}>
          <p className="m3-body-medium" style={{ color: "var(--md-error)" }}>
            {toFriendlyMessage(error)}
          </p>
          <Button variant="tonal" onClick={refresh}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!loading && !error && userLevel <= 0 && (
        <div style={styles.centerMsg}>
          <p className="m3-body-medium" style={{ color: "var(--md-error)" }}>
            Seu acesso está inativo. Entre em contato com o administrador.
          </p>
        </div>
      )}

      {!loading && !error && userLevel > 0 && grouped.length === 0 && (
        <div style={styles.centerMsg}>
          <p className="m3-body-medium" style={{ color: "var(--md-on-surface-variant)" }}>
            Nenhuma apostila disponível no momento.
          </p>
        </div>
      )}

      <div style={styles.folderList}>
        {!loading &&
          !error &&
          userLevel > 0 &&
          grouped.map(([componente, lista], index) => (
            <SubjectFolder
              key={componente}
              title={componente}
              apostilas={lista}
              userLevel={userLevel}
              color={CORES_MATERIA[index % CORES_MATERIA.length]}
              onOpen={handleOpen}
            />
          ))}
      </div>

      {toast && <Snackbar>{toast}</Snackbar>}
    </div>
  );
}

function SubjectFolder({
  title,
  apostilas,
  userLevel,
  color,
  onOpen,
}: {
  title: string;
  apostilas: Apostila[];
  userLevel: number;
  color: string;
  onOpen: (a: Apostila) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={{ ...styles.folder, borderLeftColor: color }}>
      <button
        className="m3-interactive"
        style={styles.folderHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div>
          <p className="m3-title-medium">{title}</p>
          <p className="m3-body-small" style={styles.folderCount}>
            {apostilas.length} apostila{apostilas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span style={{ color, display: "flex" }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </span>
      </button>

      {
        }
      <div style={{ ...styles.folderBodyWrap, gridTemplateRows: expanded ? "1fr" : "0fr" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={styles.folderBody}>
            {apostilas.map((a) => {
              const locked = !hasAccess(userLevel, a.nivelRequerido);
              return (
                <button
                  key={a.id}
                  className="m3-interactive"
                  style={{ ...styles.apostilaItem, opacity: locked ? 0.6 : 1 }}
                  onClick={() => onOpen(a)}
                  aria-label={
                    locked
                      ? `${a.titulo} — bloqueado, requer assinatura ${toRoleName(a.nivelRequerido)}`
                      : `Abrir ${a.titulo}`
                  }
                  tabIndex={expanded ? 0 : -1}
                >
                  <span style={{ textAlign: "left" }}>
                    <span className="m3-body-large" style={styles.apostilaTitle}>
                      {a.titulo}
                    </span>
                    {locked && (
                      <span className="m3-body-small" style={styles.apostilaRequirement}>
                        Assinatura {toRoleName(a.nivelRequerido)} necessária
                      </span>
                    )}
                  </span>
                  <span style={{ color: locked ? "var(--md-error)" : color, display: "flex" }}>
                    {locked ? <Lock size={20} /> : <KeyboardArrowRight size={20} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--md-surface)",
    padding: `calc(8px + env(safe-area-inset-top, 0px)) 16px calc(40px + env(safe-area-inset-bottom, 0px))`,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcome: { padding: 20 },
  assinatura: { margin: "8px 0 0" },
  welcomeHint: { margin: "4px 0 0", opacity: 0.8 },
  centerMsg: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "24px 0",
  },
  folderList: { display: "flex", flexDirection: "column", gap: 12 },
  folder: { borderLeft: "4px solid" },
  folderHeader: {
    width: "100%",
    background: "none",
    border: "none",
    color: "inherit",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    cursor: "pointer",
    textAlign: "left",
    minHeight: 64,
  },
  folderCount: { color: "var(--md-on-surface-variant)", marginTop: 4 },
  folderBodyWrap: {
    display: "grid",
    transition: "grid-template-rows var(--md-dur-medium2) var(--md-ease-standard)",
  },
  folderBody: {
    padding: "0 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  apostilaItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: "var(--md-surface-container-highest)",
    color: "inherit",
    border: "none",
    borderRadius: "var(--md-shape-md)",
    padding: "14px 16px",
    cursor: "pointer",
    minHeight: 56,
  },
  apostilaTitle: { display: "block" },
  apostilaRequirement: { display: "block", color: "var(--md-on-surface-variant)", marginTop: 2 },
};
