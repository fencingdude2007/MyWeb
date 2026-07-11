import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Input, Spinner } from "../components/ui";
import { api, type Collection } from "../lib/api";

export function CollectionsPage() {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: api.listCollections,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["collections"] });

  const createMutation = useMutation({
    mutationFn: (n: string) => api.createCollection(n),
    onSuccess: () => {
      setName("");
      invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCollection(id),
    onSuccess: invalidate,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) createMutation.mutate(name.trim());
  };

  const onDelete = (c: Collection) => {
    if (window.confirm(`Delete collection "${c.name}"? (Pages stay in your library.)`)) {
      deleteMutation.mutate(c.id);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Collections</h1>

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <Input
          placeholder="New collection name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
          Create
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !collections || collections.length === 0 ? (
        <p className="text-neutral-500">
          No collections yet. Create one above, then add pages from any page's detail view.
        </p>
      ) : (
        <div className="space-y-3">
          {collections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-neutral-900 bg-neutral-950 p-4"
            >
              <Link to={`/collections/${c.id}`} className="min-w-0 flex-1">
                <span className="font-medium text-neutral-100 hover:text-indigo-300">
                  {c.name}
                </span>
                <span className="ml-2 text-xs text-neutral-500">
                  {c.page_count} {c.page_count === 1 ? "page" : "pages"}
                </span>
              </Link>
              <button
                onClick={() => onDelete(c)}
                className="rounded-lg border border-red-900/60 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-950/40"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
