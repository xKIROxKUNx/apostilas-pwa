import { Suspense, lazy, useEffect, useRef } from "react";
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

const PdfReaderScreen = lazy(() => import("@/screens/PdfReaderScreen"));

function RequireSession({ children }: { children: React.ReactNode }) {
  const { sessionState } = useAuth();
  if (sessionState === "checking") return null;
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RouteFallback() {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--md-surface)",
        color: "var(--md-on-surface-variant)",
      }}
    >
      Carregando…
    </div>
  );
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
            <AppRoutes />
          </ApostilasProvider>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  );
}
