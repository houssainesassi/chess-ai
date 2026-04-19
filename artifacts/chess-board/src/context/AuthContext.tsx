import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "chess_auth_token";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

interface AuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: (callback?: () => void) => void;
}

const AuthContext = createContext<AuthContextValue>({
  isLoaded: false,
  isSignedIn: false,
  user: null,
  getToken: async () => null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: () => {},
});

function parseToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.userId || !payload.email || !payload.username) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { id: payload.userId, email: payload.email, username: payload.username };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const qcRef = useRef<ReturnType<typeof useQueryClient> | null>(null);

  try {
    qcRef.current = useQueryClient();
  } catch {}

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const parsed = parseToken(token);
      setUser(parsed);
      if (!parsed) localStorage.removeItem(TOKEN_KEY);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    setAuthTokenGetter(async () => localStorage.getItem(TOKEN_KEY));
    return () => setAuthTokenGetter(null);
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message ?? "Login failed");
    }
    const { token } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    const parsed = parseToken(token);
    setUser(parsed);
    qcRef.current?.clear();
  }, []);

  const signUp = useCallback(async (email: string, username: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message ?? "Registration failed");
    }
    const { token } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    const parsed = parseToken(token);
    setUser(parsed);
    qcRef.current?.clear();
  }, []);

  const signOut = useCallback((callback?: () => void) => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    qcRef.current?.clear();
    callback?.();
  }, []);

  return (
    <AuthContext.Provider value={{ isLoaded, isSignedIn: !!user, user, getToken, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUser() {
  const { user } = useContext(AuthContext);
  return { user };
}

export function useClerkCompat() {
  const { signOut } = useContext(AuthContext);
  return { signOut };
}
