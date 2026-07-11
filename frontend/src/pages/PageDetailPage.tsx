import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Input, Spinner } from "../components/ui";
import { api, type Page } from "../lib/api";

// Inject <base> so a snapshot's relative image/CSS URLs resolve against the
// original site when rendered inside the sandboxed iframe.
function withBaseTag(html: string, url: string): string {
  const base = `<base href="${url}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + base);
  return base + html;
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function isPdf(url: string): boolean {
  return /\.pdf($|\?)/i.test(url);
}

function googlePreview(url: string): string | null {
  const m = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/);
  return m ? `https://docs.google.com/${m[1]}/d/${m[2]}/preview` : null;
}

function Media({ page }: { page: Page }) {
  const yt = youtubeId(page.url);
  const gpreview = googlePreview(page.url);

  if (yt) {
    return (
      <Section label="Video">
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-neutral-800">
          <iframe
            title="YouTube video"
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${yt}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </Section>
    );
  }

  if (isPdf(page.url)) {
    return (
      <Section label="PDF">
        <iframe
          title="PDF"
          src={page.url}
          className="h-[80vh] w-full rounded-xl border border-neutral-800 bg-white"
        />
      </Section>
    );
  }

  if (gpreview) {
    return (
      <Section label="Document">
        <iframe
          title="Google file"
          src={gpreview}
          className="h-[80vh] w-full rounded-xl border border-neutral-800 bg-white"
        />
      </Section>
    );
  }

  return (
    <Section label="Saved snapshot">
      {page.snapshot ? (
        <iframe
          title="Saved page snapshot"
          sandbox=""
          srcDoc={withBaseTag(page.snapshot, page.url)}
          className="h-[70vh] w-full rounded-xl border border-neutral-800 bg-white"
        />
      ) : (
        <p className="text-neutral-500">
          No snapshot saved for this page.{" "}
          <a href={page.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
            Open the original ↗
          </a>
        </p>
      )}
    </Section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">{label}</h2>
      {children}
    </div>
  );
}

function CollectionPicker({ pageId }: { pageId: number }) {
  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: api.listCollections,
  });
  const queryClient = useQueryClient();
  const [added, setAdded] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (collectionId: number) => api.addToCollection(collectionId, pageId),
    onSuccess: (_, collectionId) => {
      const name = collections?.find((c) => c.id === collectionId)?.name ?? "collection";
      setAdded(name);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  if (!collections || collections.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) addMutation.mutate(Number(e.target.value));
          e.target.value = "";
        }}
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-indigo-500"
      >
        <option value="" disabled>
          Add to collection…
        </option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {added && <span className="text-xs text-green-400">✓ Added to {added}</span>}
    </div>
  );
}

function Notes({ pageId }: { pageId: number }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const { data: notes } = useQuery({
    queryKey: ["notes", pageId],
    queryFn: () => api.listNotes(pageId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notes", pageId] });
  const createMutation = useMutation({
    mutationFn: () => api.createNote(pageId, body.trim()),
    onSuccess: () => {
      setBody("");
      invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => api.deleteNote(noteId),
    onSuccess: invalidate,
  });

  return (
    <Section label="Notes">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) createMutation.mutate();
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="Add a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" disabled={createMutation.isPending || !body.trim()}>
          Add
        </Button>
      </form>
      {notes && notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-neutral-900 bg-neutral-950 p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-neutral-300">{note.body}</p>
              <button
                onClick={() => deleteMutation.mutate(note.id)}
                className="shrink-0 text-xs text-neutral-600 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Related({ pageId }: { pageId: number }) {
  const { data: related } = useQuery({
    queryKey: ["related", pageId],
    queryFn: () => api.relatedPages(pageId),
  });
  if (!related || related.length === 0) return null;
  return (
    <Section label="Related pages">
      <ul className="space-y-2">
        {related.map((r) => (
          <li key={r.id} className="flex items-baseline gap-2 text-sm">
            <Link to={`/page/${r.id}`} className="truncate text-indigo-400 hover:underline">
              {r.title || r.url}
            </Link>
            {r.site_name && (
              <span className="shrink-0 text-xs text-neutral-600">{r.site_name}</span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: page, isLoading } = useQuery({
    queryKey: ["page", id],
    queryFn: () => api.getPage(id!),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePage(id!),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["page", id] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      navigate("/", { replace: true });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: (fav: boolean) => api.updatePage(id!, { is_favorite: fav }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["page", id], (old: Page | undefined) =>
        old ? { ...old, is_favorite: updated.is_favorite } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });

  const handleDelete = () => {
    if (window.confirm("Delete this saved page? This cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  useEffect(() => {
    if (id) api.trackVisit(id).catch(() => {});
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (!page) return <p className="text-neutral-500">Page not found.</p>;

  return (
    <article>
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-indigo-400 hover:underline">
          ← Back to search
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => favoriteMutation.mutate(!page.is_favorite)}
            disabled={favoriteMutation.isPending}
            title={page.is_favorite ? "Unfavorite" : "Favorite"}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              page.is_favorite
                ? "border-amber-700/60 text-amber-400 hover:bg-amber-950/30"
                : "border-neutral-800 text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            ★ {page.is_favorite ? "Favorited" : "Favorite"}
          </button>
          <CollectionPicker pageId={page.id} />
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-950/40 disabled:cursor-default disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">{page.title || page.url}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {page.site_name}
        {page.author ? ` · ${page.author}` : ""}
        <span
          className={`ml-2 rounded px-2 py-0.5 text-xs ${
            page.status === "ready"
              ? "bg-green-900/40 text-green-400"
              : "bg-neutral-800 text-neutral-400"
          }`}
        >
          {page.status}
        </span>
      </p>
      <a
        href={page.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block break-all text-sm text-indigo-400 hover:underline"
      >
        {page.url} ↗
      </a>

      <Media page={page} />

      {page.summary && (
        <div className="mt-8 rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-indigo-400">AI summary</h2>
          <p className="leading-relaxed text-neutral-200">{page.summary}</p>
        </div>
      )}

      <Notes pageId={page.id} />
      <Related pageId={page.id} />
    </article>
  );
}
