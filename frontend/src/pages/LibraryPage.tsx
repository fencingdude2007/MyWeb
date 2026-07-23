import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Star, X } from "lucide-react";

import { ImportBookmarks } from "../components/ImportBookmarks";
import { PageRow } from "../components/PageRow";
import { Spinner, focusRing } from "../components/ui";
import { Reveal } from "../lib/motion";
import { api, type Page, type Tag } from "../lib/api";
import { cn } from "../lib/utils";

type Filter = "all" | "favorites";

export function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [tag, setTag] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const params: Record<string, string> = {};
  if (filter === "favorites") params.favorites = "true";
  if (tag) params.tag = tag;

  const { data: pages, isLoading } = useQuery({
    queryKey: ["pages", filter, tag],
    queryFn: () => api.listPages(params),
    // Freshly saved pages arrive as "pending" — poll until they're processed
    // so the library updates in place with each save.
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status === "pending" || p.status === "processing")
        ? 3000
        : false,
  });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const { data: reviewPages } = useQuery({
    queryKey: ["pages", "review-count"],
    queryFn: () => api.listPages({ needs_review: "true", limit: "1" }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pages"] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
  };

  const favoriteMutation = useMutation({
    mutationFn: (page: Page) => api.updatePage(page.id, { is_favorite: !page.is_favorite }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (page: Page) => api.deletePage(page.id),
    onSuccess: invalidate,
  });

  const onDelete = (page: Page) => {
    if (window.confirm(`Delete "${page.title || page.url}"? This cannot be undone.`)) {
      deleteMutation.mutate(page);
    }
  };

  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 capitalize transition-colors",
      focusRing,
      active
        ? "border-indigo-400/50 bg-indigo-500/10 text-indigo-200"
        : "border-white/10 text-neutral-300 hover:border-white/20 hover:text-neutral-100",
    );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        {reviewPages && reviewPages.length > 0 && (
          <Link
            to="/review"
            className={cn(
              "rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110",
              focusRing,
            )}
          >
            Review imported pages
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {(["all", "favorites"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={chip(filter === f)}
          >
            {f === "favorites" && <Star className="h-3.5 w-3.5" />}
            {f}
          </button>
        ))}
        {tag && (
          <button
            onClick={() => setTag(null)}
            aria-label={`Clear tag filter #${tag}`}
            className={chip(true)}
          >
            #{tag} <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {tags && tags.length > 0 && !tag && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {tags.slice(0, 20).map((t: Tag) => (
            <button
              key={t.id}
              onClick={() => setTag(t.name)}
              className={cn(
                "rounded-full bg-white/[0.05] px-2.5 py-0.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-100",
                focusRing,
              )}
            >
              #{t.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !pages || pages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {pages.map((page, i) => (
            <Reveal key={page.id} delay={Math.min(i * 50, 300)}>
              <PageRow
                page={page}
                onToggleFavorite={(p) => favoriteMutation.mutate(p)}
                onDelete={onDelete}
              />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center rounded-2xl px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] text-neutral-400">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="mt-4 max-w-sm text-neutral-400">
        No pages here yet. Save pages with the Chrome extension — or import your bookmarks
        right now.
      </p>
      <ImportBookmarks className="mt-4" />
    </div>
  );
}
