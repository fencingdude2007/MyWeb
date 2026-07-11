import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageRow } from "../components/PageRow";
import { Spinner } from "../components/ui";
import { api, type Page } from "../lib/api";

export function ReviewPage() {
  const queryClient = useQueryClient();

  const { data: pages, isLoading } = useQuery({
    queryKey: ["pages", "review"],
    queryFn: () => api.listPages({ needs_review: "true", limit: "500" }),
    refetchInterval: (query) =>
      // Imported pages process in the background — poll while any are pending.
      query.state.data?.some((p) => p.status === "pending" || p.status === "processing")
        ? 3000
        : false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pages"] });

  const keepMutation = useMutation({
    mutationFn: (page: Page) => api.updatePage(page.id, { needs_review: false }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (page: Page) => api.deletePage(page.id),
    onSuccess: invalidate,
  });
  const keepAllMutation = useMutation({
    mutationFn: async () => {
      for (const page of pages ?? []) {
        await api.updatePage(page.id, { needs_review: false });
      }
    },
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <Link to="/library" className="text-sm text-indigo-400 hover:underline">
        ← Back to library
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review imported bookmarks</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Keep the pages you want in your library, delete the rest.
            {pages && pages.length > 0 && ` ${pages.length} left to review.`}
          </p>
        </div>
        {pages && pages.length > 0 && (
          <button
            onClick={() => keepAllMutation.mutate()}
            disabled={keepAllMutation.isPending}
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
          >
            {keepAllMutation.isPending ? "Keeping…" : "Keep all"}
          </button>
        )}
      </div>

      {!pages || pages.length === 0 ? (
        <p className="text-neutral-500">
          Nothing to review. Import bookmarks from the Chrome extension popup to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <PageRow key={page.id} page={page}>
              <button
                onClick={() => keepMutation.mutate(page)}
                className="rounded-lg border border-green-900/60 px-2.5 py-1 text-xs text-green-400 transition-colors hover:bg-green-950/40"
              >
                Keep
              </button>
              <button
                onClick={() => deleteMutation.mutate(page)}
                className="rounded-lg border border-red-900/60 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-950/40"
              >
                Delete
              </button>
            </PageRow>
          ))}
        </div>
      )}
    </div>
  );
}
