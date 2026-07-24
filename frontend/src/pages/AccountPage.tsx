import { Link } from "react-router-dom";
import { ArrowLeft, Download, LogOut, Puzzle } from "lucide-react";

import { Card, focusRing } from "../components/ui";
import { EXTENSION_URL } from "../lib/constants";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

async function downloadExport() {
  const data = await api.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "myweb-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function AccountPage() {
  const { user, logout } = useAuth();

  const memberSince = user
    ? new Date(user.created_at).toLocaleDateString([], { month: "long", year: "numeric" })
    : "";

  return (
    <div className="max-w-md">
      <Link
        to="/"
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-sm text-indigo-300 hover:text-indigo-200",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Account</h1>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-semibold uppercase text-white">
            {user?.email?.[0] ?? "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-100">{user?.email}</p>
            {memberSince && (
              <p className="text-xs text-neutral-400">Member since {memberSince}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        <Link
          to={EXTENSION_URL}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-neutral-200 transition-colors hover:bg-white/10",
            focusRing,
          )}
        >
          <Puzzle className="h-4 w-4 text-indigo-300" />
          Get the Chrome extension
        </Link>
        <button
          onClick={downloadExport}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-neutral-200 transition-colors hover:bg-white/10",
            focusRing,
          )}
        >
          <Download className="h-4 w-4 text-indigo-300" />
          Export my data (JSON)
        </button>
        <button
          onClick={logout}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-neutral-200 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300",
            focusRing,
          )}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );
}
