import { Component, type ReactNode } from "react";

/** Last-resort catch so a render error shows a recoverable screen instead of a
 *  blank page. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center px-4 text-center">
          <div className="glass max-w-md rounded-2xl p-8">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-neutral-400">
              An unexpected error broke this view. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:brightness-110"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
