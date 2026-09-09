import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold font-mono mb-2">404</h1>
      <p className="text-foreground mb-1">Page not found.</p>
      <p className="text-text-secondary mb-1">
        The page you requested does not exist. It may have been moved or
        removed.
      </p>
      <p className="text-text-secondary mb-4">
        Check the URL for typos, or navigate from the home page.
      </p>
      <p className="font-mono text-sm text-muted mb-6">ERR_NOT_FOUND</p>
      <Link href="/" className="text-accent">
        Return home
      </Link>
    </div>
  );
}
