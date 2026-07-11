import { Link } from "react-router-dom";

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
      className="block rounded-xl border border-neutral-900 bg-neutral-950 p-4 transition-colors hover:border-neutral-700"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium text-neutral-100">{result.title || result.url}</h3>
        {showScore && (
          <span className="shrink-0 text-xs text-neutral-600" title="relevance score">
            {result.score.toFixed(2)}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">
        {result.site_name || hostname(result.url)}
      </p>
      {result.snippet && (
        <p
          className="snippet mt-2 text-sm leading-relaxed text-neutral-400"
          dangerouslySetInnerHTML={{ __html: result.snippet }}
        />
      )}
    </Link>
  );
}
