import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { applyTokens } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Backend redirects here with #access_token=...&refresh_token=...
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");

    if (access) {
      applyTokens(access, refresh ?? undefined)
        .then(() => navigate("/", { replace: true }))
        .catch(() => navigate("/login", { replace: true }));
    } else {
      navigate("/login", { replace: true });
    }
  }, [applyTokens, navigate]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner />
    </div>
  );
}
