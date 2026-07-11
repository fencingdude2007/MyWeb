import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ResultCard } from "../components/ResultCard";
import { Input, Spinner } from "../components/ui";
import { api } from "../lib/api";

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);

  useEffect(() => {
    setText(q);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    setParams(trimmed ? { q: trimmed } : {});
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-6">
        <Input
          autoFocus
          placeholder="Search your saved pages in plain language…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="py-3 text-base"
        />
      </form>

      {isFetching && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!isFetching && data && (
        <>
          {!q && (
            <p className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
              Recently saved
            </p>
          )}
          {data.results.length === 0 ? (
            <p className="text-neutral-500">
              No results{q ? ` for “${q}”` : ""}. Save pages with the Chrome extension to
              build your searchable internet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.results.map((r) => (
                <ResultCard key={r.id} result={r} showScore={!!q} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
