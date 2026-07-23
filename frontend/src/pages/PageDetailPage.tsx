import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ArrowLeft, ArrowUpRight, Check, Sparkles, Star, Trash2, X } from "lucide-react";

import { Button, Input, Spinner, IconButton, focusRing } from "../components/ui";
import { cn } from "../lib/utils";
import { api, type Page } from "../lib/api";

// Prepare a snapshot for the sandboxed viewer: inject <base> so relative
// image/CSS URLs resolve against the original site, and strip the meta tags
// that most often blank a snapshot — a copied Content-Security-Policy (which
// would block the page's own styles/images inside srcdoc) and meta-refresh
// redirects. Scripts are already blocked by the iframe sandbox.
function withBaseTag(html: string, url: string): string {
  html = html.replace(
    /<meta[^>]+http-equiv=["']?(content-security-policy|refresh)["']?[^>]*>/gi,
    "",
  );
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

/** Extracted text rendered as a clean, readable article — the universal
 *  fallback that makes every saved page renderable even when its snapshot is
 *  missing or broken (paywalls, heavy JS, blocked assets, …). */
function ReaderView({ text }: { text: string }) {
  const blocks = text
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="glass rounded-2xl px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-2xl space-y-4">
        {blocks.map((b, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-neutral-200">
            {b}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Every way a saved page can render, as tabs: live embeds for video/PDF/Docs,
 *  the captured snapshot, and the Reader fallback. Defaults to the richest
 *  available view; Reader is always there when text was extracted. */
function Media({ page }: { page: Page }) {
  const yt = youtubeId(page.url);
  const gpreview = googlePreview(page.url);
  const pdf = isPdf(page.url);

  const views: { id: string; label: string }[] = [];
  if (yt) views.push({ id: "video", label: "Video" });
  if (pdf) views.push({ id: "pdf", label: "PDF" });
  if (gpreview) views.push({ id: "doc", label: "Document" });
  if (page.snapshot) views.push({ id: "snapshot", label: "Snapshot" });
  if (page.content) views.push({ id: "reader", label: yt ? "Transcript" : "Reader" });

  const [active, setActive] = useState(views[0]?.id);

  if (views.length === 0) {
    return (
      <div className="mt-6">
        <p className="glass rounded-2xl p-5 text-sm text-neutral-400">
          {page.status === "ready"
            ? "No preview is available for this page."
            : "This page is still processing — the preview will appear shortly."}{" "}
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-300 hover:underline"
          >
            Open the original ↗
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {views.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" role="tablist">
          {views.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={active === v.id}
              onClick={() => setActive(v.id)}
              className={cn(
                "rounded-full border px-3 py-1 transition-colors",
                focusRing,
                active === v.id
                  ? "border-indigo-400/50 bg-indigo-500/10 text-indigo-200"
                  : "border-white/10 text-neutral-300 hover:border-white/20 hover:text-neutral-100",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {active === "video" && yt && (
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
          <iframe
            title="YouTube video"
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${yt}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {active === "pdf" && (
        <iframe
          title="PDF"
          src={page.url}
          className="h-[80vh] w-full rounded-2xl border border-white/10 bg-white"
        />
      )}

      {active === "doc" && gpreview && (
        <iframe
          title="Google file"
          src={gpreview}
          className="h-[80vh] w-full rounded-2xl border border-white/10 bg-white"
        />
      )}

      {active === "snapshot" && page.snapshot && (
        <iframe
          title="Saved page snapshot"
          sandbox=""
          srcDoc={withBaseTag(page.snapshot, page.url)}
          className="h-[70vh] w-full rounded-2xl border border-white/10 bg-white"
        />
      )}

      {active === "reader" && page.content && <ReaderView text={page.content} />}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-400">{label}</h2>
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
        className={cn(
          "min-h-9 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-neutral-200 backdrop-blur transition-colors hover:bg-white/10",
          focusRing,
        )}
      >
        <option value="" disabled className="bg-neutral-900">
          Add to collection…
        </option>
        {collections.map((c) => (
          <option key={c.id} value={c.id} className="bg-neutral-900">
            {c.name}
          </option>
        ))}
      </select>
      {added && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Added to {added}
        </span>
      )}
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
              <IconButton
                onClick={() => deleteMutation.mutate(note.id)}
                aria-label="Delete note"
                title="Delete note"
                className="h-9 w-9 hover:bg-red-500/15 hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </IconButton>
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
              <span className="shrink-0 text-xs text-neutral-400">{r.site_name}</span>
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
  if (!page) return <p className="text-neutral-400">Page not found.</p>;

  return (
    <article className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className={cn(
            "inline-flex items-center gap-1.5 rounded text-sm text-indigo-300 hover:text-indigo-200",
            focusRing,
          )}
        >
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => favoriteMutation.mutate(!page.is_favorite)}
            disabled={favoriteMutation.isPending}
            title={page.is_favorite ? "Unfavorite" : "Favorite"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors",
              focusRing,
              page.is_favorite
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10",
            )}
          >
            <Star className="h-4 w-4" fill={page.is_favorite ? "currentColor" : "none"} />
            {page.is_favorite ? "Favorited" : "Favorite"}
          </button>
          <CollectionPicker pageId={page.id} />
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-default disabled:opacity-50",
              focusRing,
            )}
          >
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{page.title || page.url}</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
        <span>
          {page.site_name}
          {page.author ? ` · ${page.author}` : ""}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs",
            page.status === "ready"
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-white/10 text-neutral-300",
          )}
        >
          {page.status}
        </span>
      </p>
      <a
        href={page.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "mt-2 inline-flex items-center gap-1 break-all rounded text-sm text-indigo-300 hover:underline",
          focusRing,
        )}
      >
        {page.url} <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
      </a>

      <Media key={page.id} page={page} />

      {page.summary && (
        <div className="mt-8 rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/[0.06] p-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" /> AI summary
          </h2>
          <p className="leading-relaxed text-neutral-100">{page.summary}</p>
        </div>
      )}

      <Notes pageId={page.id} />
      <Related pageId={page.id} />
    </article>
  );
}
