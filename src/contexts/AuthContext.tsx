import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearAuthSession,
  getStoredAuthSession,
  loginWithIdentifier,
  saveAuthSession,
  setAuthExpiredHandler,
} from "../lib/api";
import api from "../lib/api";
import { normalizeAuthRole, type AuthRole } from "../lib/auth";

type StoredSession = {
  role: AuthRole;
  token: string;
  profile?: Record<string, unknown> | null;
};

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: AuthRole | null;
  authToken: string | null;
  restoreSession: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<StoredSession>;
  startSession: (
    role: unknown,
    token: unknown,
    profile?: Record<string, unknown> | null,
  ) => Promise<StoredSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getValidationEndpoint(session: StoredSession): string {
  if (session.role === "delivery_partner") {
    return "/delivery-partner/profile";
  }

  const profile = session.profile ?? {};
  const userId = profile.user_id ?? profile.userId ?? profile.id;
  return userId == null
    ? "/orders/mine"
    : `/users/profile/${encodeURIComponent(String(userId))}`;
}

function isInvalidTokenError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<StoredSession | null>(null);
  const authOperation = useRef(0);

  const restoreSession = useCallback(async () => {
    const operation = ++authOperation.current;
    setIsLoading(true);
    try {
      const saved = await getStoredAuthSession();
      if (operation !== authOperation.current) return;
      if (!saved) {
        sessionRef.current = null;
        setSession(null);
        return;
      }

      const restored: StoredSession = {
        role: saved.role as AuthRole,
        token: saved.token,
        profile: saved.profile,
      };
      sessionRef.current = restored;

      try {
        await api.get(getValidationEndpoint(restored));
      } catch (error: unknown) {
        if (operation !== authOperation.current) return;
        if (isInvalidTokenError(error)) {
          await clearAuthSession(restored.role, restored.token);
          if (operation !== authOperation.current) return;
          sessionRef.current = null;
          setSession(null);
          return;
        }
        console.warn(
          "Could not validate the saved session; retaining it until the API is available.",
          error,
        );
      }

      if (operation !== authOperation.current) return;
      setSession(restored);
    } catch (error: unknown) {
      console.error("Failed to restore the saved authentication session:", error);
      if (operation !== authOperation.current) return;
      sessionRef.current = null;
      setSession(null);
    } finally {
      if (operation === authOperation.current) setIsLoading(false);
    }
  }, []);

  const startSession = useCallback(
    async (
      roleValue: unknown,
      tokenValue: unknown,
      profile?: Record<string, unknown> | null,
    ) => {
      authOperation.current += 1;
      setIsLoading(false);
      const role = normalizeAuthRole(roleValue);
      const token =
        typeof tokenValue === "string" ? tokenValue.trim() : "";
      if (!role || !token) {
        throw new Error("The login response did not include a valid role and token.");
      }

      await saveAuthSession(role, token, profile);
      const authenticatedSession: StoredSession = { role, token, profile };
      sessionRef.current = authenticatedSession;
      setSession(authenticatedSession);
      return authenticatedSession;
    },
    [],
  );

  const login = useCallback(
    async (identifier: string, password: string) => {
      const operation = ++authOperation.current;
      setIsLoading(false);
      const result = await loginWithIdentifier(identifier, password);
      if (operation !== authOperation.current) {
        throw new Error("This login attempt was cancelled.");
      }
      const profile =
        typeof result.user === "object" && result.user !== null
          ? (result.user as Record<string, unknown>)
          : null;
      return startSession(result.role ?? profile?.role, result.token, profile);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    authOperation.current += 1;
    const activeSession = sessionRef.current;
    if (activeSession) await clearAuthSession(activeSession.role);
    sessionRef.current = null;
    setSession(null);
  }, []);

  useEffect(() => {
    const unregister = setAuthExpiredHandler(async (role: AuthRole, token: string) => {
      const activeSession = sessionRef.current;
      if (!activeSession || activeSession.role !== role || activeSession.token !== token) {
        return;
      }
      authOperation.current += 1;
      try {
        const cleared = await clearAuthSession(activeSession.role, activeSession.token);
        const currentSession = sessionRef.current;
        if (
          !cleared ||
          currentSession?.role !== activeSession.role ||
          currentSession.token !== activeSession.token
        ) {
          return;
        }
        sessionRef.current = null;
        setSession(null);
        setIsLoading(false);
      } catch (error: unknown) {
        console.error("Failed to clear an expired authentication session:", error);
        sessionRef.current = null;
        setSession(null);
        setIsLoading(false);
      }
    });
    void restoreSession();
    return unregister;
  }, [restoreSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session?.role && session.token),
      userRole: session?.role ?? null,
      authToken: session?.token ?? null,
      restoreSession,
      login,
      startSession,
      logout,
    }),
    [isLoading, login, logout, restoreSession, session, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
