import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Button, Input, TypingDots } from "../components/ui";
import { Reveal } from "../lib/motion";
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
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Sparkles className="h-6 w-6 text-indigo-400" />
        Ask your pages
      </h1>
      <p className="mb-6 mt-1 text-sm text-neutral-400">
        Ask a question in plain language — the answer comes from the pages you've saved,
        with sources.
      </p>

      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="ask-question" className="sr-only">
          Ask a question about your saved pages
        </label>
        <Input
          id="ask-question"
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
        <div className="mt-8 flex items-center gap-3 text-sm text-neutral-400">
          <TypingDots />
          Reading your saved pages…
        </div>
      )}

      {askMutation.isError && (
        <p className="mt-6 text-sm text-red-400">
          {(askMutation.error as Error).message || "Something went wrong."}
        </p>
      )}

      {result && !askMutation.isPending && (
        <div className="mt-8 animate-fade-up">
          <div className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/[0.06] p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              Answer
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-neutral-100">
              {result.answer}
            </p>
          </div>

          {result.sources.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Sources
              </h2>
              <ol className="space-y-2">
                {result.sources.map((s, i) => (
                  <Reveal key={s.id} delay={i * 60}>
                    <li className="flex items-baseline gap-2 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-xs text-neutral-400">
                        {i + 1}
                      </span>
                      <Link
                        to={`/page/${s.id}`}
                        className="truncate text-indigo-300 hover:underline"
                      >
                        {s.title || s.url}
                      </Link>
                      {s.site_name && (
                        <span className="shrink-0 text-xs text-neutral-500">{s.site_name}</span>
                      )}
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
