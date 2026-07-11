import { Link } from "react-router-dom";

import type { Page } from "../lib/api";

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function PageRow({
  page,
  onToggleFavorite,
  onDelete,
  children,
}: {
  page: Page;
  onToggleFavorite?: (page: Page) => void;
  onDelete?: (page: Page) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-900 bg-neutral-950 p-4">
      <div className="min-w-0 flex-1">
        <Link
          to={`/page/${page.id}`}
          className="block truncate font-medium text-neutral-100 hover:text-indigo-300"
        >
          {page.title || page.url}
        </Link>
        <p className="mt-0.5 text-xs text-neutral-500">
          {page.site_name || hostname(page.url)}
          {page.status !== "ready" && (
            <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
              {page.status}
            </span>
          )}
        </p>
        {page.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{page.summary}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(page)}
            title={page.is_favorite ? "Unfavorite" : "Favorite"}
            className={
              page.is_favorite
                ? "text-amber-400 hover:text-amber-300"
                : "text-neutral-600 hover:text-neutral-300"
            }
          >
            ★
          </button>
        )}
        {children}
        {onDelete && (
          <button
            onClick={() => onDelete(page)}
            className="rounded-lg border border-red-900/60 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-950/40"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
