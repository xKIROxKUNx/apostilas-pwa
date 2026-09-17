import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User as FirebaseUser } from "firebase/auth";
import type { SessionState } from "@/types/domain";
import { DeviceBindingError } from "@/types/domain";
import * as authService from "@/firebase/authService";
import { checkDeviceBinding } from "@/firebase/userService";
import { getOrCreateDeviceId } from "@/security/deviceId";
import { getSavedNickname, saveNickname, clearNickname } from "@/state/localPrefs";

interface AuthContextValue {
  sessionState: SessionState;
  user: FirebaseUser | null;
  blockedMessage: string | null;
  consumeBlockedMessage: () => void;
  login: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  endSession: () => Promise<void>;
  savedNickname: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.then((v) => v),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [savedNickname, setSavedNickname] = useState("");
  const validated = useRef(false);

  useEffect(() => {
    getSavedNickname().then(setSavedNickname);
  }, []);

  useEffect(() => {
    return authService.observeAuthState((atual) => {
      if (atual !== null) return;
      setUser(null);
      setSessionState((estado) => (estado === "valid" ? "invalid" : estado));
    });
  }, []);

  useEffect(() => {
    if (validated.current) return;
    validated.current = true;

    (async () => {
      const initialUser = await authService.waitForInitialAuthState();

      if (!initialUser) {
        setSessionState("invalid");
        return;
      }
      setUser(initialUser);

      const reloadOk = await withTimeout(
        authService.reloadCurrentUser().then(
          () => true,
          (err) => {
            const code = (err as { code?: string })?.code ?? "";
            if (code === "auth/user-disabled" || code === "auth/user-token-expired") {
              throw err;
            }
            return true;
          },
        ),
        TIMEOUT_MS,
      ).catch(() => "revoked" as const);

      if (reloadOk === "revoked") {
        setSessionState("invalid");
        return;
      }

      try {
        const deviceId = await getOrCreateDeviceId();
        const bindingResult = await withTimeout(checkDeviceBinding(deviceId), TIMEOUT_MS);
        if (bindingResult === null) {
          setSessionState("valid");
          return;
        }
      } catch (err) {
        if (err instanceof DeviceBindingError) {
          setBlockedMessage(err.message);
          await authService.forceSignOut();
          setSessionState("invalid");
          return;
        }
      }

      setSessionState("valid");
    })();
  }, []);

  const login = async (email: string, password: string, nickname: string) => {
    const credential = await authService.login(email, password);
    const deviceId = await getOrCreateDeviceId();
    try {
      await checkDeviceBinding(deviceId);
    } catch (err) {
      await authService.forceSignOut();
      throw err;
    }
    await saveNickname(nickname);
    setSavedNickname(nickname.trim());
    setUser(credential);
    setSessionState("valid");
  };

  const logout = async () => {
    await clearNickname();
    await authService.logout();
    setUser(null);
    setSessionState("invalid");
  };

  const endSession = async () => {
    await authService.forceSignOut();
    setUser(null);
    setSessionState("invalid");
  };

  const consumeBlockedMessage = () => setBlockedMessage(null);

  return (
    <AuthContext.Provider
      value={{
        sessionState,
        user,
        blockedMessage,
        consumeBlockedMessage,
        login,
        logout,
        endSession,
        savedNickname,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
