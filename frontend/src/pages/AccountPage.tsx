import { useState } from "react";
import { Link } from "react-router-dom";

import { Button, Input } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export function AccountPage() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError("");
    try {
      await api.setPassword(password);
      setStatus("done");
      setPassword("");
    } catch (err) {
      setStatus("error");
      setError((err as Error).message || "Could not set password");
    }
  };

  return (
    <div className="max-w-md">
      <Link to="/" className="text-sm text-indigo-400 hover:underline">
        ← Back to search
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Account</h1>
      <p className="mt-1 text-sm text-neutral-500">{user?.email}</p>

      <div className="mt-6 rounded-xl border border-neutral-900 bg-neutral-950 p-5">
        <h2 className="text-sm font-medium">Set a password</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Signed in with Google? Set a password here so you can also log in from the
          Chrome extension (which uses email + password).
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input
            type="password"
            placeholder="New password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {status === "error" && <p className="text-sm text-red-400">{error}</p>}
          {status === "done" && (
            <p className="text-sm text-green-400">
              Password set. Log in to the extension with {user?.email} and this password.
            </p>
          )}
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Set password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
