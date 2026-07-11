import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

import { cn } from "../lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors",
        "hover:bg-indigo-500 disabled:cursor-default disabled:opacity-50",
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
        "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm",
        "text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-indigo-500",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner() {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-indigo-500" />
  );
}
