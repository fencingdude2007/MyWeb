import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Trash2 } from "lucide-react";

import { Button, Input, Spinner, IconButton } from "../components/ui";
import { Reveal } from "../lib/motion";
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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Collections</h1>

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <label htmlFor="new-collection" className="sr-only">
          New collection name
        </label>
        <Input
          id="new-collection"
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
        <p className="text-neutral-400">
          No collections yet. Create one above, then add pages from any page's detail view.
        </p>
      ) : (
        <div className="space-y-3">
          {collections.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i * 50, 300)}>
              <div className="glass card-hover flex items-center justify-between rounded-2xl p-4">
                <Link to={`/collections/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-indigo-300">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-neutral-100 transition-colors hover:text-indigo-300">
                      {c.name}
                    </span>
                    <span className="ml-2 text-xs text-neutral-400">
                      {c.page_count} {c.page_count === 1 ? "page" : "pages"}
                    </span>
                  </span>
                </Link>
                <IconButton
                  onClick={() => onDelete(c)}
                  aria-label={`Delete collection ${c.name}`}
                  title="Delete"
                  className="hover:bg-red-500/15 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
