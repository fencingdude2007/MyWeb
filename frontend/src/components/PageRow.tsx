import { Link } from "react-router-dom";
import { Star, Trash2 } from "lucide-react";

import { IconButton } from "./ui";
import { cn } from "../lib/utils";
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
    <div className="glass card-hover flex items-start gap-3 rounded-2xl p-4">
      <div className="min-w-0 flex-1">
        <Link
          to={`/page/${page.id}`}
          className="block truncate font-medium text-neutral-100 transition-colors hover:text-indigo-300"
        >
          {page.title || page.url}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
          <span className="truncate">{page.site_name || hostname(page.url)}</span>
          {page.status !== "ready" && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-neutral-300">
              {page.status}
            </span>
          )}
        </p>
        {page.summary && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-400">
            {page.summary}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onToggleFavorite && (
          <IconButton
            onClick={() => onToggleFavorite(page)}
            aria-label={page.is_favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={page.is_favorite}
            title={page.is_favorite ? "Unfavorite" : "Favorite"}
            className={cn(
              page.is_favorite && "text-amber-400 hover:text-amber-300",
            )}
          >
            <Star
              className="h-4 w-4"
              fill={page.is_favorite ? "currentColor" : "none"}
            />
          </IconButton>
        )}
        {children}
        {onDelete && (
          <IconButton
            onClick={() => onDelete(page)}
            aria-label="Delete page"
            title="Delete"
            className="hover:bg-red-500/15 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
