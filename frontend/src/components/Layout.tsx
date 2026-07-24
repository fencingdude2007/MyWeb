import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  FolderOpen,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Puzzle,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { EXTENSION_URL } from "../lib/constants";

import { cn } from "../lib/utils";
import { focusRing } from "./ui";
import { useAuth } from "../lib/auth";

const NAV = [
  { to: "/", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/collections", label: "Collections", icon: FolderOpen },
  { to: "/ask", label: "Ask", icon: Sparkles },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

function Brand() {
  return (
    <Link
      to="/"
      className={cn(
        "whitespace-nowrap rounded text-lg font-semibold tracking-tight",
        focusRing,
      )}
    >
<span className="text-gradient">My</span>Web
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070708]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Brand />
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-2.5 py-1.5 text-neutral-400 transition-colors hover:text-neutral-100",
                      focusRing,
                      isActive && "bg-white/[0.06] text-neutral-100",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm">
            <Link
              to={EXTENSION_URL}
              title="Get the Chrome extension"
              className={cn(
                "hidden h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-3 text-neutral-200 transition-colors hover:border-white/20 hover:bg-white/10 lg:inline-flex",
                focusRing,
              )}
            >
              <Puzzle className="h-4 w-4 text-indigo-300" /> Extension
            </Link>
            <Link
              to="/account"
              title={`Account — ${user?.email ?? ""}`}
              aria-label="Account"
              className={cn(
                "hidden h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06] sm:inline-flex",
                focusRing,
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[11px] font-semibold uppercase text-white">
                {user?.email?.[0] ?? "?"}
              </span>
            </Link>
            <button
              onClick={logout}
              title="Log out"
              aria-label="Log out"
              className={cn(
                "hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-300 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 sm:inline-flex",
                focusRing,
              )}
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-300 hover:bg-white/10 hover:text-neutral-100 md:hidden",
                focusRing,
              )}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <nav className="animate-fade-in border-t border-white/[0.06] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-neutral-100",
                      focusRing,
                      isActive && "bg-white/[0.06] text-neutral-100",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              <div className="my-1 h-px bg-white/[0.06]" />
              <Link
                to="/account"
                className={cn(
                  "truncate rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-100",
                  focusRing,
                )}
              >
                {user?.email}
              </Link>
              <button
                onClick={logout}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-neutral-300 hover:bg-white/[0.06] hover:text-neutral-100",
                  focusRing,
                )}
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
