import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { Layout } from "./Layout";
import { Spinner } from "./ui";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/welcome" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
