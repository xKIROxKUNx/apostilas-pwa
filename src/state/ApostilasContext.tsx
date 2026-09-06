import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Apostila, UserProfile } from "@/types/domain";
import { getUserProfile } from "@/firebase/userService";
import { getApostilas } from "@/firebase/apostilaService";
import { useAuth } from "./AuthContext";

interface ApostilasContextValue {
  userProfile: UserProfile | null;
  apostilas: Apostila[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  findApostila: (id: string) => Apostila | undefined;
}

const ApostilasContext = createContext<ApostilasContextValue | null>(null);

export function ApostilasProvider({ children }: { children: ReactNode }) {
  const { sessionState } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [apostilas, setApostilas] = useState<Apostila[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, lista] = await Promise.all([getUserProfile(), getApostilas()]);
      setUserProfile(profile);
      setApostilas(lista);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionState === "valid") {
      load();
    }
  }, [sessionState, refreshTick, load]);

  return (
    <ApostilasContext.Provider
      value={{
        userProfile,
        apostilas,
        loading,
        error,
        refresh: () => setRefreshTick((t) => t + 1),
        findApostila: (id) => apostilas.find((a) => a.id === id),
      }}
    >
      {children}
    </ApostilasContext.Provider>
  );
}

export function useApostilas(): ApostilasContextValue {
  const ctx = useContext(ApostilasContext);
  if (!ctx) throw new Error("useApostilas precisa estar dentro de <ApostilasProvider>.");
  return ctx;
}
