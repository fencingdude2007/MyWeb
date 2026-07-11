import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageRow } from "../components/PageRow";
import { Spinner } from "../components/ui";
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
    <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={suggestion.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-neutral-100 hover:text-indigo-300"
          >
            {suggestion.title} ↗
          </a>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{suggestion.url}</p>
          {suggestion.snippet && (
            <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{suggestion.snippet}</p>
          )}
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || saved}
          className="shrink-0 rounded-lg border border-indigo-900/60 px-2.5 py-1 text-xs text-indigo-300 transition-colors hover:bg-indigo-950/40 disabled:opacity-60"
        >
          {saved ? "✓ Saved" : saveMutation.isPending ? "Saving…" : "Save"}
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
  const {
    data: suggestions,
    isFetching: loadingSuggestions,
  } = useQuery({
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

  return (
    <div>
      <Link to="/collections" className="text-sm text-indigo-400 hover:underline">
        ← All collections
      </Link>

      <h1 className="mt-4 mb-6 text-2xl font-semibold">{collection?.name ?? "…"}</h1>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !pages || pages.length === 0 ? (
        <p className="text-neutral-500">
          No pages yet. Add pages from a page's detail view ("Add to collection").
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <PageRow key={page.id} page={page}>
              <button
                onClick={() => removeMutation.mutate(page.id)}
                className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-900"
              >
                Remove
              </button>
            </PageRow>
          ))}
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">
            Suggested from the web
          </h2>
          {!showSuggestions && (
            <button
              onClick={() => setShowSuggestions(true)}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-900"
            >
              Find suggestions
            </button>
          )}
        </div>

        {showSuggestions && (
          <div className="mt-3">
            {loadingSuggestions ? (
              <div className="flex items-center gap-3 text-sm text-neutral-500">
                <Spinner /> Searching the web for sites like this collection…
              </div>
            ) : !suggestions || suggestions.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No suggestions found — add a few pages to the collection first so there's a
                theme to search for.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <SuggestionCard key={s.url} suggestion={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
