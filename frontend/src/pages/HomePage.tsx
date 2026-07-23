import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Puzzle, Save, Search } from "lucide-react";

import { ImportBookmarks } from "../components/ImportBookmarks";
import { PageRow } from "../components/PageRow";
import { ResultCard } from "../components/ResultCard";
import { Input, Spinner } from "../components/ui";
import { Reveal } from "../lib/motion";
import { EXTENSION_URL } from "../lib/constants";
import { api } from "../lib/api";

/** First-run onboarding: a new account has nothing to search, so show the
 *  three ways to fill the library instead of a dead end. */
function OnboardingCard() {
  return (
    <div className="glass animate-fade-up rounded-2xl p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight">
        Welcome — let's build your searchable internet.
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        Your library is empty. Three ways to fill it:
      </p>
      <ol className="mt-5 space-y-4">
        <li className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-inset ring-white/10">
            <Puzzle className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-neutral-100">Install the Chrome extension</p>
            <p className="mt-0.5 text-sm text-neutral-400">
              Save any page in one click, sweep whole windows of tabs, park distractions.{" "}
              <a
                href={EXTENSION_URL}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-300 hover:underline"
              >
                Get it here →
              </a>
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-inset ring-white/10">
            <Save className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-neutral-100">Import your bookmarks</p>
            <p className="mt-0.5 text-sm text-neutral-400">
              Export bookmarks from any browser (or Pocket/Omnivore) as HTML, then drop the
              file here.
            </p>
            <ImportBookmarks className="mt-3" />
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-inset ring-white/10">
            <Search className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-neutral-100">Then search like you think</p>
            <p className="mt-0.5 text-sm text-neutral-400">
              Everything you save becomes searchable by meaning — and you can ask questions
              with cited answers on the Ask page.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);

  useEffect(() => {
    setText(q);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: !!q,
  });

  // With no query, show the newest saves directly from the library — including
  // pages still processing — and poll while any are, so a page saved from the
  // extension appears here the moment it lands.
  const { data: recent, isLoading: loadingRecent } = useQuery({
    queryKey: ["pages", "recent"],
    queryFn: () => api.listPages({ limit: "20" }),
    enabled: !q,
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status === "pending" || p.status === "processing")
        ? 3000
        : false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    setParams(trimmed ? { q: trimmed } : {});
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-6">
        <label htmlFor="search-query" className="sr-only">
          Search your saved pages
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
          <Input
            id="search-query"
            type="search"
            autoFocus
            placeholder="Search your saved pages in plain language…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="py-3.5 pl-12 text-base"
          />
        </div>
      </form>

      {(isFetching || (!q && loadingRecent)) && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {q && !isFetching && data && (
        <>
          {data.results.length === 0 ? (
            <p className="text-neutral-400">
              No results for “{q}”. Try different words — search matches by meaning, not
              just keywords.
            </p>
          ) : (
            <div className="space-y-3">
              {data.results.map((r, i) => (
                <Reveal key={r.id} delay={Math.min(i * 60, 360)}>
                  <ResultCard result={r} showScore />
                </Reveal>
              ))}
            </div>
          )}
        </>
      )}

      {!q && !loadingRecent && recent && (
        <>
          {recent.length === 0 ? (
            <OnboardingCard />
          ) : (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Recently saved
              </p>
              <div className="space-y-3">
                {recent.map((p, i) => (
                  <Reveal key={p.id} delay={Math.min(i * 60, 360)}>
                    <PageRow page={p} />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
