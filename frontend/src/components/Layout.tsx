import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth";

const NAV = [
  { to: "/", label: "Search" },
  { to: "/library", label: "Library" },
  { to: "/collections", label: "Collections" },
  { to: "/ask", label: "Ask" },
  { to: "/dashboard", label: "Dashboard" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold">
              MyWeb <span className="text-indigo-400">AI</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "text-neutral-400 hover:text-neutral-100",
                      isActive && "text-neutral-100",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <Link to="/account" className="hidden hover:text-neutral-100 sm:inline">
              {user?.email}
            </Link>
            <button onClick={logout} className="hover:text-neutral-100">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
