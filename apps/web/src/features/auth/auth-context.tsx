import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { authApi as defaultAuthApi, type AuthApi } from "../../api/auth-api";
import { HttpApiError } from "../../api/http-api";
import type { AuthResponseDto, UserDto } from "../../api/schemawise-contracts";

export interface AuthState {
  readonly status: "unknown" | "authenticated" | "unauthenticated";
  readonly user: UserDto | null;
  readonly csrfToken: string | null;
  readonly initializationError?: string;
}

type AuthAction =
  | { type: "authenticated"; response: AuthResponseDto }
  | { type: "unauthenticated" }
  | { type: "initializationError" };

const initialState: AuthState = { status: "unknown", user: null, csrfToken: null };

function reducer(_state: AuthState, action: AuthAction): AuthState {
  if (action.type === "authenticated") return { status: "authenticated", user: action.response.user, csrfToken: action.response.csrfToken };
  if (action.type === "initializationError") return { status: "unauthenticated", user: null, csrfToken: null, initializationError: "We couldn't check your session. You can keep working and try signing in." };
  return { status: "unauthenticated", user: null, csrfToken: null };
}

interface AuthContextValue extends AuthState {
  readonly api: AuthApi;
  setAuthenticated(response: AuthResponseDto): void;
  setUnauthenticated(): void;
  refreshSession(): Promise<boolean>;
  logout(): Promise<void>;
}

const standaloneAuth: AuthContextValue = { ...initialState, status: "unauthenticated", api: defaultAuthApi, setAuthenticated: () => undefined, setUnauthenticated: () => undefined, refreshSession: async () => false, logout: async () => undefined };
const AuthContext = createContext<AuthContextValue>(standaloneAuth);

export function AuthProvider({ children, api = defaultAuthApi }: { readonly children: ReactNode; readonly api?: AuthApi }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const setAuthenticated = useCallback((response: AuthResponseDto) => dispatch({ type: "authenticated", response }), []);
  const setUnauthenticated = useCallback(() => dispatch({ type: "unauthenticated" }), []);
  const refreshSession = useCallback(async () => {
    try { setAuthenticated(await api.me()); return true; }
    catch (error) {
      if (error instanceof HttpApiError && error.status === 401) setUnauthenticated();
      else dispatch({ type: "initializationError" });
      return false;
    }
  }, [api, setAuthenticated, setUnauthenticated]);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  const logout = useCallback(async () => {
    try { await api.logout(state.csrfToken ?? undefined); }
    finally { setUnauthenticated(); }
  }, [api, setUnauthenticated, state.csrfToken]);

  const value = useMemo<AuthContextValue>(() => ({ ...state, api, setAuthenticated, setUnauthenticated, refreshSession, logout }), [api, logout, refreshSession, setAuthenticated, setUnauthenticated, state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
