"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold font-mono mb-2">500</h1>
      <p className="text-foreground mb-1">Something went wrong.</p>
      <p className="text-text-secondary mb-1">
        An unexpected error occurred while processing your request. This is
        likely a server-side issue.
      </p>
      <p className="text-text-secondary mb-4">
        Try again, or return to the home page. If the problem persists, the
        issue has been logged.
      </p>
      <p className="font-mono text-sm text-muted mb-6">
        ERR_INTERNAL{error.digest ? ` [${error.digest}]` : ""}
      </p>
      <button
        onClick={reset}
        className="text-accent mr-4 bg-transparent border-0 cursor-pointer underline"
      >
        Try again
      </button>
      <a href="/" className="text-accent">
        Return home
      </a>
    </div>
  );
}
