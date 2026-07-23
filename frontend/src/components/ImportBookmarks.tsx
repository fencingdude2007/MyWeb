import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Upload } from "lucide-react";

import { focusRing } from "./ui";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

const BATCH = 200; // matches the backend's per-request cap
const MAX_URLS = 2000;

type Phase =
  | { kind: "idle" }
  | { kind: "working"; msg: string }
  | { kind: "done"; msg: string }
  | { kind: "error"; msg: string };

/** Import a browser bookmarks export (bookmarks.html) straight from the web
 *  app — works for Chrome/Firefox/Safari exports and Pocket/Omnivore exports,
 *  no extension required. */
export function ImportBookmarks({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const onFile = async (file: File) => {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const urls = [
      ...new Set(
        [...doc.querySelectorAll("a[href]")]
          .map((a) => a.getAttribute("href") ?? "")
          .filter((h) => /^https?:/i.test(h)),
      ),
    ].slice(0, MAX_URLS);

    if (urls.length === 0) {
      setPhase({ kind: "error", msg: "No links found in that file." });
      return;
    }

    try {
      let created = 0;
      let skipped = 0;
      for (let i = 0; i < urls.length; i += BATCH) {
        setPhase({
          kind: "working",
          msg: `Importing… ${Math.min(i + BATCH, urls.length)}/${urls.length}`,
        });
        const out = await api.importPages(urls.slice(i, i + BATCH));
        created += out.created;
        skipped += out.skipped;
      }
      setPhase({
        kind: "done",
        msg: `Imported ${created} bookmark${created === 1 ? "" : "s"} (${skipped} already saved).`,
      });
    } catch (err) {
      setPhase({ kind: "error", msg: (err as Error).message || "Import failed — try again." });
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={phase.kind === "working"}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-neutral-200 transition-colors hover:bg-white/10 disabled:opacity-50",
          focusRing,
        )}
      >
        <Upload className="h-4 w-4" /> Import bookmarks (.html)
      </button>
      {phase.kind !== "idle" && (
        <p
          className={cn(
            "mt-2 text-sm",
            phase.kind === "error" ? "text-red-400" : "text-neutral-400",
            phase.kind === "done" && "text-emerald-400",
          )}
        >
          {phase.msg}{" "}
          {phase.kind === "done" && (
            <Link to="/review" className="text-indigo-300 hover:underline">
              Review them now →
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
