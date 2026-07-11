import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { Button, Input, Spinner } from "../components/ui";
import { api, type AskResponse } from "../lib/api";

export function AskPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);

  const askMutation = useMutation({
    mutationFn: (q: string) => api.ask(q),
    onSuccess: setResult,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) askMutation.mutate(question.trim());
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ask your pages</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Ask a question in plain language — the answer comes from the pages you've saved,
        with sources.
      </p>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          autoFocus
          placeholder="e.g. What did that article say about Postgres indexing?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="py-3 text-base"
        />
        <Button type="submit" disabled={askMutation.isPending || !question.trim()}>
          Ask
        </Button>
      </form>

      {askMutation.isPending && (
        <div className="flex items-center gap-3 py-8 text-sm text-neutral-500">
          <Spinner /> Reading your saved pages…
        </div>
      )}

      {askMutation.isError && (
        <p className="mt-6 text-sm text-red-400">
          {(askMutation.error as Error).message || "Something went wrong."}
        </p>
      )}

      {result && !askMutation.isPending && (
        <div className="mt-8">
          <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-5">
            <p className="whitespace-pre-wrap leading-relaxed text-neutral-200">
              {result.answer}
            </p>
          </div>

          {result.sources.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">Sources</h2>
              <ol className="space-y-2">
                {result.sources.map((s, i) => (
                  <li key={s.id} className="flex items-baseline gap-2 text-sm">
                    <span className="shrink-0 text-neutral-600">[{i + 1}]</span>
                    <Link
                      to={`/page/${s.id}`}
                      className="truncate text-indigo-400 hover:underline"
                    >
                      {s.title || s.url}
                    </Link>
                    {s.site_name && (
                      <span className="shrink-0 text-xs text-neutral-600">{s.site_name}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
