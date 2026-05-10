import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { DesignerPage } from "./pages/DesignerPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SandboxPage } from "./pages/SandboxPage.js";
import { SchemaPage } from "./pages/SchemaPage.js";
import { TeamsPage } from "./pages/TeamsPage.js";
import { TokensPage } from "./pages/TokensPage.js";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <TeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tokens"
            element={
              <ProtectedRoute>
                <TokensPage />
              </ProtectedRoute>
            }
          />
          <Route path="/schema" element={<SchemaPage />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/diagrams/:id" element={<DesignerPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
