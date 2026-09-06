import { Suspense, lazy, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import SplashScreen from "@/screens/SplashScreen";
import LoginScreen from "@/screens/LoginScreen";
import HomeScreen from "@/screens/HomeScreen";
import { initAccessGuard } from "@/security/wasm/accessGuard";
import { purgeLegacyStrokes } from "@/pdf/annotationsStore";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { ThemeProvider } from "@/state/ThemeContext";
import { ApostilasProvider } from "@/state/ApostilasContext";

const PdfReaderScreen = lazy(() => import("@/screens/PdfReaderScreen"));

function RequireSession({ children }: { children: React.ReactNode }) {
  const { sessionState } = useAuth();
  if (sessionState === "checking") return null;
  if (sessionState !== "valid") return <Navigate to="/login" replace />;
  return <>{children}</>;
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
            <HomeScreen />
          </RequireSession>
        }
      />
      <Route
        path="/apostila/:apostilaId"
        element={
          <RequireSession>
            <Suspense fallback={<RouteFallback />}>
              <PdfReaderScreen />
            </Suspense>
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
