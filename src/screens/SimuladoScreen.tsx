import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useApostilas } from "@/state/ApostilasContext";
import { useAuth } from "@/state/AuthContext";
import { useSubscription } from "@/state/useSubscription";
import SubscriptionExpiredScreen from "@/screens/SubscriptionExpiredScreen";
import { downloadSimulado } from "@/firebase/simuladoService";
import { isStorageDenied, toFriendlyMessage } from "@/firebase/errorMessages";
import { canOpenApostilaAnyDevice } from "@/security/wasm/accessGuard";
import { getOrCreateDeviceId } from "@/security/deviceId";
import { antiCopyGuard } from "@/security/antiCopyGuard";
import { visibilityGuard } from "@/security/visibilityGuard";
import SimuladoApp from "@/simulado/SimuladoApp";
import type { Simulado } from "@/simulado/types";
import { IconButton, Spinner, TopAppBar } from "@/components";
import { ArrowBack } from "@/components/icons";

export default function SimuladoScreen() {
  const { apostilaId } = useParams<{ apostilaId: string }>();
  const navigate = useNavigate();
  const { findApostila, userProfile, loading: apostilasLoading } = useApostilas();
  const { user } = useAuth();
  const { expirada } = useSubscription();

  const apostila = apostilaId ? findApostila(apostilaId) : undefined;

  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  const [simulado, setSimulado] = useState<Simulado | null>(null);
  const [erro, setErro] = useState<Error | null>(null);
  const [negadoPeloServidor, setNegadoPeloServidor] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    if (apostilasLoading) return;
    if (!apostila || !userProfile || expirada) {
      setAccessState("denied");
      return;
    }
    let cancelled = false;
    (async () => {
      const deviceId = await getOrCreateDeviceId();
      const allowed = canOpenApostilaAnyDevice(
        userProfile.nivelAcesso,
        apostila.nivelRequerido,
        deviceId,
        userProfile.deviceIds,
      );
      if (!cancelled) setAccessState(allowed ? "allowed" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, [apostila, userProfile, apostilasLoading, expirada]);

  useEffect(() => {
    if (!apostila || apostila.tipo !== "simulado" || accessState !== "allowed") return;
    let cancelled = false;
    downloadSimulado(apostila.urlConteudo)
      .then((dados) => {
        if (!cancelled) setSimulado(dados);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isStorageDenied(err)) {
          setNegadoPeloServidor(true);
          return;
        }
        setErro(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [apostila, accessState]);

  useEffect(() => {
    antiCopyGuard.start();
    visibilityGuard.start();
    const unsubVisibility = visibilityGuard.subscribe((state) => setOculto(state === "hidden"));
    return () => {
      antiCopyGuard.stop();
      visibilityGuard.stop();
      unsubVisibility();
    };
  }, []);

  const voltar = () => navigate("/home");

  if (apostila && apostila.tipo !== "simulado") {
    return <Navigate to={`/apostila/${apostila.id}`} replace />;
  }

  if (negadoPeloServidor) {
    return <SubscriptionExpiredScreen />;
  }

  if (apostilasLoading || accessState === "checking") {
    return <Mensagem onBack={voltar}>Verificando acesso…</Mensagem>;
  }

  if (!apostila) {
    return <Mensagem onBack={voltar}>Simulado não encontrado. Volte para a Home e tente novamente.</Mensagem>;
  }

  if (accessState === "denied") {
    return <Mensagem onBack={voltar}>Você não tem acesso a este conteúdo.</Mensagem>;
  }

  if (erro) {
    return <Mensagem onBack={voltar}>Erro ao carregar o simulado: {toFriendlyMessage(erro)}</Mensagem>;
  }

  if (!simulado) {
    return (
      <Mensagem onBack={voltar} carregando>
        Carregando simulado…
      </Mensagem>
    );
  }

  return (
    <>
      <SimuladoApp
        titulo={apostila.titulo}
        simulado={simulado}
        escopoArmazenamento={`${user?.uid ?? "anon"}:${apostila.id}`}
        onSair={voltar}
      />
      {user?.email && (
        <div className="sim-marca-dagua" aria-hidden>
          {user.email}
        </div>
      )}
      {oculto && (
        <div style={styles.privacyOverlay}>
          <p className="m3-body-large" style={{ color: "var(--md-on-surface-variant)" }}>
            Conteúdo oculto
          </p>
        </div>
      )}
    </>
  );
}

function Mensagem({
  children,
  onBack,
  carregando,
}: {
  children: React.ReactNode;
  onBack: () => void;
  carregando?: boolean;
}) {
  return (
    <div style={styles.page}>
      <TopAppBar>
        <IconButton label="Voltar" onClick={onBack}>
          <ArrowBack />
        </IconButton>
      </TopAppBar>
      <div style={styles.centerMsg}>
        {carregando ? (
          <Spinner label={String(children)} />
        ) : (
          <p className="m3-body-large" style={{ color: "var(--md-error)", textAlign: "center", padding: 24 }}>
            {children}
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "var(--md-surface)",
  },
  centerMsg: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyOverlay: {
    position: "fixed",
    inset: 0,
    background: "var(--md-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "var(--z-privacy)" as unknown as number,
  },
};
