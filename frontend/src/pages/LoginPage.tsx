import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button, Input } from "../components/ui";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { user, login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">
          MyWeb <span className="text-indigo-400">AI</span>
        </h1>
        <p className="mb-6 text-sm text-neutral-400">Your personal, searchable internet.</p>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>

        <button
          onClick={loginWithGoogle}
          className="mt-3 w-full rounded-lg border border-neutral-800 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-center text-sm text-neutral-400">
          {mode === "login" ? "No account?" : "Have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-indigo-400 hover:underline"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
