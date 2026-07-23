import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import { sanitizeSnippet } from "../lib/utils";
import type { SearchResult } from "../lib/api";

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function ResultCard({
  result,
  showScore,
}: {
  result: SearchResult;
  showScore: boolean;
}) {
  return (
    <Link
      to={`/page/${result.id}`}
      className="glass card-hover group block rounded-2xl p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-1.5 font-medium text-neutral-100">
          <span className="truncate">{result.title || result.url}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100" />
        </h3>
        {showScore && (
          <span
            className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-neutral-400"
            title="relevance score"
          >
            {result.score.toFixed(2)}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-neutral-400">
        {result.site_name || hostname(result.url)}
      </p>
      {result.snippet && (
        <p
          className="snippet mt-2 text-sm leading-relaxed text-neutral-400"
          dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }}
        />
      )}
    </Link>
  );
}
