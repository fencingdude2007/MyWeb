import { Link } from "react-router-dom";
import { ArrowLeft, Download, Puzzle } from "lucide-react";

import { focusRing } from "../components/ui";
import { cn } from "../lib/utils";

const STEPS = [
  'Download the file below and unzip "myweb-extension.zip".',
  "Open chrome://extensions in Chrome.",
  "Turn on Developer mode (toggle, top-right).",
  'Click "Load unpacked" and select the unzipped folder.',
  "Pin MyWeb (the 🧩 puzzle icon), then sign in — you're set.",
];

export function ExtensionPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Link
        to="/"
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-sm text-indigo-300 hover:text-indigo-200",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-inset ring-white/10">
          <Puzzle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Get the MyWeb extension</h1>
          <p className="text-sm text-neutral-400">Save any page, right from your toolbar.</p>
        </div>
      </div>

      <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Chrome Web Store version coming soon
      </span>

      <a
        href="/myweb-extension.zip"
        download="myweb-extension.zip"
        className={cn(
          "mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110",
          focusRing,
        )}
      >
        <Download className="h-5 w-5" /> Download extension (.zip)
      </a>

      <div className="glass mt-8 rounded-2xl p-6">
        <h2 className="text-sm font-medium">Install in 5 steps</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-neutral-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs text-indigo-300">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs leading-relaxed text-neutral-500">
          Until the Chrome Web Store listing is approved, MyWeb installs as an unpacked
          extension in Developer mode — it's the same build, just loaded manually.
        </p>
      </div>
    </div>
  );
}
