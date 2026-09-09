"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "64px 16px",
          maxWidth: "1280px",
          marginInline: "auto",
        }}
      >
        <h1
          style={{
            fontSize: "1.875rem",
            fontWeight: 700,
            fontFamily: "monospace",
            marginBottom: "8px",
          }}
        >
          500
        </h1>
        <p style={{ marginBottom: "4px" }}>Something went wrong.</p>
        <p style={{ color: "#a3a3a3", marginBottom: "4px" }}>
          A critical error occurred. The application could not recover
          gracefully.
        </p>
        <p style={{ color: "#a3a3a3", marginBottom: "16px" }}>
          Try refreshing the page. If the problem persists, the issue has been
          logged.
        </p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "0.875rem",
            color: "#737373",
            marginBottom: "24px",
          }}
        >
          ERR_CRITICAL{error.digest ? ` [${error.digest}]` : ""}
        </p>
        <button
          onClick={reset}
          style={{
            color: "#4a7cff",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "1rem",
            marginRight: "16px",
          }}
        >
          Try again
        </button>
        <a href="/" style={{ color: "#4a7cff" }}>
          Return home
        </a>
      </body>
    </html>
  );
}
