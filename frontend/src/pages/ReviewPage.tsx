import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Trash2 } from "lucide-react";

import { PageRow } from "../components/PageRow";
import { Spinner, focusRing } from "../components/ui";
import { Reveal } from "../lib/motion";
import { cn } from "../lib/utils";
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

  const pillBtn = (tone: "keep" | "delete") =>
    cn(
      "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors",
      focusRing,
      tone === "keep"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
    );

  return (
    <div>
      <Link
        to="/library"
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-sm text-indigo-300 hover:text-indigo-200",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" /> Back to library
      </Link>

      <div className="mb-6 mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review imported bookmarks</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Keep the pages you want in your library, delete the rest.
            {pages && pages.length > 0 && ` ${pages.length} left to review.`}
          </p>
        </div>
        {pages && pages.length > 0 && (
          <button
            onClick={() => keepAllMutation.mutate()}
            disabled={keepAllMutation.isPending}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10 disabled:opacity-50",
              focusRing,
            )}
          >
            {keepAllMutation.isPending ? "Keeping…" : "Keep all"}
          </button>
        )}
      </div>

      {!pages || pages.length === 0 ? (
        <p className="text-neutral-400">
          Nothing to review. Import bookmarks from the Chrome extension popup to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page, i) => (
            <Reveal key={page.id} delay={Math.min(i * 50, 300)}>
              <PageRow page={page}>
                <button onClick={() => keepMutation.mutate(page)} className={pillBtn("keep")}>
                  <Check className="h-3.5 w-3.5" /> Keep
                </button>
                <button onClick={() => deleteMutation.mutate(page)} className={pillBtn("delete")}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </PageRow>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
