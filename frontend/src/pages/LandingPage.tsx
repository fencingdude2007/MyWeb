import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../lib/auth";

const FEATURES = [
  {
    title: "Save anything in one click",
    body: "Articles, videos, PDFs, Google Docs — the Chrome extension snapshots the page exactly as you saw it.",
  },
  {
    title: "Search it like you think",
    body: "Hybrid semantic + keyword search over everything you've saved. Plain-language queries, ranked results.",
  },
  {
    title: "Ask questions, get cited answers",
    body: "Ask your library anything and get an AI answer built only from your saved pages, with sources.",
  },
  {
    title: "Your data stays yours",
    body: "Import your existing bookmarks to start instantly, and export everything as JSON any time.",
  },
];

export function LandingPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold">
            MyWeb <span className="text-indigo-400">AI</span>
          </span>
          <Link
            to="/login"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4">
        <section className="py-20 text-center">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Your personal, <span className="text-indigo-400">searchable</span> internet.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-400">
            Save the pages that matter, then find them again with natural-language search —
            or just ask questions and get answers from your own library.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
          >
            Get started — it's free
          </Link>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-neutral-900 bg-neutral-950 p-6">
              <h2 className="font-medium text-neutral-100">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
