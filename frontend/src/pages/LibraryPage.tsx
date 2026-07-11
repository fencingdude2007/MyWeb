import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageRow } from "../components/PageRow";
import { Spinner } from "../components/ui";
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Library</h1>
        {reviewPages && reviewPages.length > 0 && (
          <Link
            to="/review"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
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
            className={cn(
              "rounded-full border px-3 py-1 capitalize",
              filter === f
                ? "border-indigo-500 text-indigo-300"
                : "border-neutral-800 text-neutral-400 hover:text-neutral-200",
            )}
          >
            {f === "favorites" ? "★ favorites" : f}
          </button>
        ))}
        {tag && (
          <button
            onClick={() => setTag(null)}
            className="rounded-full border border-indigo-500 px-3 py-1 text-indigo-300"
          >
            #{tag} ✕
          </button>
        )}
      </div>

      {tags && tags.length > 0 && !tag && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {tags.slice(0, 20).map((t: Tag) => (
            <button
              key={t.id}
              onClick={() => setTag(t.name)}
              className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-400 hover:text-neutral-100"
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
        <p className="text-neutral-500">
          No pages here yet. Save pages with the Chrome extension, or import your bookmarks
          from the extension popup.
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              onToggleFavorite={(p) => favoriteMutation.mutate(p)}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
