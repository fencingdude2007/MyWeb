import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Check, ExternalLink, Sparkles } from "lucide-react";

import { PageRow } from "../components/PageRow";
import { Button, Spinner, TypingDots, focusRing } from "../components/ui";
import { Reveal } from "../lib/motion";
import { cn } from "../lib/utils";
import { api, type Suggestion } from "../lib/api";

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const saveMutation = useMutation({
    mutationFn: () => api.savePage(suggestion.url),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });

  return (
    <div className="glass card-hover rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={suggestion.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center gap-1 rounded font-medium text-neutral-100 hover:text-indigo-300",
              focusRing,
            )}
          >
            <span className="truncate">{suggestion.title}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-500" />
          </a>
          <p className="mt-0.5 truncate text-xs text-neutral-400">{suggestion.url}</p>
          {suggestion.snippet && (
            <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{suggestion.snippet}</p>
          )}
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || saved}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200 transition-colors hover:bg-indigo-500/20 disabled:opacity-60",
            focusRing,
          )}
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" /> Saved
            </>
          ) : saveMutation.isPending ? (
            "Saving…"
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}

export function CollectionDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: collection } = useQuery({
    queryKey: ["collection", id],
    queryFn: () => api.getCollection(id!),
  });
  const { data: pages, isLoading } = useQuery({
    queryKey: ["collection-pages", id],
    queryFn: () => api.collectionPages(id!),
  });
  const { data: suggestions, isFetching: loadingSuggestions } = useQuery({
    queryKey: ["collection-suggestions", id],
    queryFn: () => api.collectionSuggestions(id!),
    enabled: showSuggestions,
    staleTime: 5 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: (pageId: number) => api.removeFromCollection(Number(id), pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-pages", id] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const synthMutation = useMutation({
    mutationFn: () => api.synthesizeCollection(id!),
  });

  // "Restore" a session: reopen every page's original URL in a new tab.
  const openAll = () => {
    for (const page of pages ?? []) window.open(page.url, "_blank", "noopener");
  };

  const hasPages = !!pages && pages.length > 0;

  return (
    <div>
      <Link
        to="/collections"
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-sm text-indigo-300 hover:text-indigo-200",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" /> All collections
      </Link>

      <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{collection?.name ?? "…"}</h1>
        {hasPages && (
          <div className="flex items-center gap-2">
            <button
              onClick={openAll}
              title="Reopen every page in this collection"
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-neutral-200 transition-colors hover:bg-white/10",
                focusRing,
              )}
            >
              <ExternalLink className="h-4 w-4" /> Open all
            </button>
            <Button onClick={() => synthMutation.mutate()} disabled={synthMutation.isPending}>
              <Sparkles className="h-4 w-4" /> Synthesize
            </Button>
          </div>
        )}
      </div>

      {synthMutation.isPending && (
        <div className="mb-6 flex items-center gap-3 text-sm text-neutral-400">
          <TypingDots /> Reading the collection…
        </div>
      )}
      {synthMutation.isError && (
        <p className="mb-6 text-sm text-red-400">
          {(synthMutation.error as Error).message || "Couldn't synthesize this collection."}
        </p>
      )}
      {synthMutation.data && !synthMutation.isPending && (
        <div className="mb-6 animate-fade-up rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/[0.06] p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" /> Synthesis
          </div>
          <p className="whitespace-pre-wrap leading-relaxed text-neutral-100">
            {synthMutation.data.summary}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !pages || pages.length === 0 ? (
        <p className="text-neutral-400">
          No pages yet. Add pages from a page's detail view ("Add to collection").
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page, i) => (
            <Reveal key={page.id} delay={Math.min(i * 50, 300)}>
              <PageRow page={page}>
                <button
                  onClick={() => removeMutation.mutate(page.id)}
                  className={cn(
                    "rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:bg-white/10",
                    focusRing,
                  )}
                >
                  Remove
                </button>
              </PageRow>
            </Reveal>
          ))}
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Suggested from the web
          </h2>
          {!showSuggestions && (
            <button
              onClick={() => setShowSuggestions(true)}
              className={cn(
                "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-white/10",
                focusRing,
              )}
            >
              Find suggestions
            </button>
          )}
        </div>

        {showSuggestions && (
          <div className="mt-3">
            {loadingSuggestions ? (
              <div className="flex items-center gap-3 text-sm text-neutral-400">
                <Spinner /> Searching the web for sites like this collection…
              </div>
            ) : !suggestions || suggestions.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No suggestions found — add a few pages to the collection first so there's a
                theme to search for.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <Reveal key={s.url} delay={Math.min(i * 50, 300)}>
                    <SuggestionCard suggestion={s} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
