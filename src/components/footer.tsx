import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-secondary">
        <span className="font-mono">Ontrifice</span>
        <nav className="flex items-center gap-6" aria-label="Footer">
          <Link href="/privacy" className="no-underline text-text-secondary hover:text-foreground">
            Privacy
          </Link>
          <Link href="/docs" className="no-underline text-text-secondary hover:text-foreground">
            API Docs
          </Link>
          <a
            href="https://github.com/LyricHagen/ontrifice"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline text-text-secondary hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
        <span>2026 Ontrifice</span>
      </div>
    </footer>
  );
}
