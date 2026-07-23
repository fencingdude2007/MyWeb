import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
} from "react";

import { cn } from "../lib/utils";

// Shared keyboard focus treatment — a visible ring on every interactive element.
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
        "cursor-pointer active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110",
        variant === "ghost" &&
          "border border-white/10 bg-white/5 text-neutral-200 hover:border-white/20 hover:bg-white/10",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm backdrop-blur",
        "text-neutral-100 placeholder:text-neutral-500 transition-colors focus:border-indigo-400/70 focus:bg-white/[0.07]",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

/** Glass surface card. Add `hover` to make it lift on hover. */
export function Card({
  className,
  hover = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn("glass rounded-2xl", hover && "card-hover", className)}
      {...props}
    />
  );
}

/** Square icon-only button with a built-in hit area + focus ring. */
export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-100 active:scale-95",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Three-dot pulsing "AI is thinking" indicator. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden="true">
      <span className="typing-dot h-2 w-2 rounded-full bg-indigo-400" />
      <span
        className="typing-dot h-2 w-2 rounded-full bg-indigo-400"
        style={{ animationDelay: "0.2s" }}
      />
      <span
        className="typing-dot h-2 w-2 rounded-full bg-indigo-400"
        style={{ animationDelay: "0.4s" }}
      />
    </span>
  );
}
