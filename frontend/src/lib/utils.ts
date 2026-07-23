import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Postgres `ts_headline` wraps matched terms in <b>…</b>. The rest of the
 * snippet is untrusted page text, so we HTML-escape everything and then
 * re-allow only the bold tags. Guarantees no arbitrary markup/script renders.
 */
export function sanitizeSnippet(html: string): string {
  const escaped = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/&lt;(\/?)b&gt;/g, "<$1b>");
}
