import { useEffect, useState } from "react";
import { useApostilas } from "@/state/ApostilasContext";
import { useSubscription } from "@/state/useSubscription";
import { canOpenApostilaAnyDevice } from "@/security/wasm/accessGuard";
import { getOrCreateDeviceId } from "@/security/deviceId";
import { antiCopyGuard } from "@/security/antiCopyGuard";
import { visibilityGuard } from "@/security/visibilityGuard";
import type { Apostila } from "@/types/domain";
import { IconButton, Spinner, TopAppBar } from "@/components";
import { ArrowBack } from "@/components/icons";

export type EstadoAcesso = "checking" | "allowed" | "denied";

export function useAcessoConteudo(apostila: Apostila | undefined): EstadoAcesso {
  const { userProfile, loading: apostilasLoading } = useApostilas();
  const { expirada } = useSubscription();
  const [accessState, setAccessState] = useState<EstadoAcesso>("checking");

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

  return apostilasLoading ? "checking" : accessState;
}

export function useProtecaoConteudo(): boolean {
  const [oculto, setOculto] = useState(false);

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

  return oculto;
}

export function MensagemConteudo({
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

export function CamadaPrivacidade() {
  return (
    <div style={styles.privacyOverlay}>
      <p className="m3-body-large" style={{ color: "var(--md-on-surface-variant)" }}>
        Conteúdo oculto
      </p>
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
