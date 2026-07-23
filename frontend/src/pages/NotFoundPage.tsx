import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div className="animate-fade-up">
        <p className="text-gradient text-6xl font-semibold">404</p>
        <h1 className="mt-3 text-xl font-semibold">This page isn't in your internet.</h1>
        <p className="mt-2 text-sm text-neutral-400">
          The link may be broken, or the page may have moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:brightness-110"
        >
          Back to MyWeb
        </Link>
      </div>
    </div>
  );
}
