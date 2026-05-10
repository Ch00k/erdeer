import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { createDiagram, fetchCurrentUser, type User } from "./api.js";
import { clearSandbox, getSandbox } from "./sandbox.js";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

async function importPendingSandbox() {
  const sandbox = getSandbox();
  if (!sandbox) return;
  try {
    await createDiagram({
      title: sandbox.title,
      amlContent: sandbox.amlContent,
      layout: sandbox.layout,
    });
    clearSandbox();
  } catch {
    // Keep localStorage so the user can retry on next load.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    fetchCurrentUser().then(async (user) => {
      if (user) await importPendingSandbox();
      setState({ user, loading: false });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
