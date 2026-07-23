import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  Download,
  Lock,
  MessageSquareQuote,
  Search,
} from "lucide-react";

import { focusRing } from "../components/ui";
import { Reveal } from "../lib/motion";
import { GITHUB_URL } from "../lib/constants";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth";

const FEATURES = [
  {
    icon: Bookmark,
    title: "Save anything in one click",
    body: "Articles, videos, PDFs, Google Docs — the Chrome extension snapshots the page exactly as you saw it.",
  },
  {
    icon: Search,
    title: "Search it like you think",
    body: "Hybrid semantic + keyword search over everything you've saved. Plain-language queries, ranked results.",
  },
  {
    icon: MessageSquareQuote,
    title: "Ask questions, get cited answers",
    body: "Ask your library anything and get an AI answer built only from your saved pages, with sources.",
  },
  {
    icon: Download,
    title: "Your data stays yours",
    body: "Import your existing bookmarks to start instantly, and export everything as JSON any time.",
  },
];

export function LandingPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/[0.06] bg-[#070708]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-gradient">My</span>Web
          </span>
          <Link
            to="/login"
            className={cn(
              "rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110",
              focusRing,
            )}
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="relative py-24 text-center sm:py-32">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Your second brain for the web
            </span>
          </div>
          <h1
            className="animate-fade-up mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
            style={{ animationDelay: "0.08s" }}
          >
            Your personal,
            <br />
            <span className="text-gradient">searchable</span> internet.
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-400"
            style={{ animationDelay: "0.16s" }}
          >
            Save the pages that matter, then find them again with natural-language search —
            or just ask questions and get answers from your own library.
          </p>
          <div
            className="animate-fade-up mt-9 flex items-center justify-center"
            style={{ animationDelay: "0.24s" }}
          >
            <Link
              to="/login"
              className={cn(
                "group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-3.5 font-medium text-white shadow-xl shadow-indigo-500/30 transition-all hover:brightness-110",
                focusRing,
              )}
            >
              Get started — it's free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="glass card-hover h-full rounded-2xl p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-inset ring-white/10">
                  <f.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-medium text-neutral-100">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </section>

        <Reveal className="pb-24">
          <div className="glass rounded-2xl p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-inset ring-white/10">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-medium text-neutral-100">Private by design</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-400">
                  No tracking, no ads, no selling data. Your library lives in your own
                  database, exports as JSON any time — and the whole stack is open source,
                  so you can self-host every byte.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500">
          <span>
<span className="text-gradient font-medium">My</span>Web — your personal,
            searchable internet.
          </span>
          <nav className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-neutral-300">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-neutral-300">
              Terms
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-neutral-300">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
