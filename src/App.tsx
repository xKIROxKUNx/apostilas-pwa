import { Component, Suspense, lazy, useEffect, useRef, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import SplashScreen from "@/screens/SplashScreen";
import LoginScreen from "@/screens/LoginScreen";
import HomeScreen from "@/screens/HomeScreen";
import SubscriptionExpiredScreen from "@/screens/SubscriptionExpiredScreen";
import { initAccessGuard } from "@/security/wasm/accessGuard";
import { purgeLegacyStrokes } from "@/pdf/annotationsStore";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { ThemeProvider } from "@/state/ThemeContext";
import { ApostilasProvider, useApostilas } from "@/state/ApostilasContext";
import { useSubscription } from "@/state/useSubscription";
import { carregarComRecuperacao, useEstadoAtualizacao } from "@/state/atualizacao";
import { TelaCarregando } from "@/components/TelaCarregando";
import { Button } from "@/components";

const PdfReaderScreen = lazy(carregarComRecuperacao(() => import("@/screens/PdfReaderScreen")));
const SimuladoScreen = lazy(carregarComRecuperacao(() => import("@/screens/SimuladoScreen")));
const LeituraScreen = lazy(carregarComRecuperacao(() => import("@/screens/LeituraScreen")));

function RequireSession({ children }: { children: React.ReactNode }) {
  const { sessionState } = useAuth();
  if (sessionState === "checking") return <TelaCarregando texto="Carregando…" />;
  if (sessionState !== "valid") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireSubscription({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useApostilas();
  const { expirada } = useSubscription();
  const bloqueado = useRef(false);

  if (!loading) bloqueado.current = userProfile !== null && expirada;

  return bloqueado.current ? <SubscriptionExpiredScreen /> : <>{children}</>;
}

function RedirectIfLoggedIn({ children }: { children: React.ReactNode }) {
  const { sessionState } = useAuth();
  if (sessionState === "valid") return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route
        path="/login"
        element={
          <RedirectIfLoggedIn>
            <LoginScreen />
          </RedirectIfLoggedIn>
        }
      />
      <Route
        path="/home"
        element={
          <RequireSession>
            <RequireSubscription>
              <HomeScreen />
            </RequireSubscription>
          </RequireSession>
        }
      />
      <Route
        path="/apostila/:apostilaId"
        element={
          <RequireSession>
            <RequireSubscription>
              <Suspense fallback={<RouteFallback />}>
                <PdfReaderScreen />
              </Suspense>
            </RequireSubscription>
          </RequireSession>
        }
      />
      <Route
        path="/simulado/:apostilaId"
        element={
          <RequireSession>
            <RequireSubscription>
              <Suspense fallback={<RouteFallback />}>
                <SimuladoScreen />
              </Suspense>
            </RequireSubscription>
          </RequireSession>
        }
      />
      <Route
        path="/leitura/:apostilaId"
        element={
          <RequireSession>
            <RequireSubscription>
              <Suspense fallback={<RouteFallback />}>
                <LeituraScreen />
              </Suspense>
            </RequireSubscription>
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RouteFallback() {
  return <TelaCarregando texto="Carregando…" />;
}

function SobreposicaoDeAtualizacao() {
  return useEstadoAtualizacao() === "atualizando" ? <TelaCarregando texto="Atualizando…" sobreposta /> : null;
}

class LimiteDeErro extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="tela-carregando">
        <h1 className="m3-headline-medium tela-carregando__titulo">Apostilas</h1>
        <p className="m3-body-large tela-carregando__texto">Não foi possível carregar esta tela. Verifique sua conexão e tente de novo.</p>
        <Button onClick={() => location.reload()}>Tentar de novo</Button>
      </div>
    );
  }
}

export default function App() {
  useEffect(() => {
    initAccessGuard();
    void purgeLegacyStrokes();
  }, []);

  return (
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <ApostilasProvider>
            <LimiteDeErro>
              <AppRoutes />
            </LimiteDeErro>
            <SobreposicaoDeAtualizacao />
          </ApostilasProvider>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  );
}
