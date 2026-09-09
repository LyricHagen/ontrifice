"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/incoherences", label: "Incoherences" },
  { href: "/conditionals", label: "Conditionals" },
  { href: "/cascades", label: "Cascades" },
  { href: "/docs", label: "Docs" },
];

export function Navigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border">
      <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-lg font-bold text-foreground no-underline"
        >
          Ontrifice
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm no-underline ${
                pathname === link.href
                  ? "text-accent"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm text-text-secondary no-underline hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm px-3 py-1 border border-accent text-accent no-underline"
            style={{ borderRadius: "2px" }}
          >
            Sign up
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-text-secondary"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {menuOpen ? (
              <path d="M4 4L16 16M16 4L4 16" />
            ) : (
              <path d="M3 5h14M3 10h14M3 15h14" />
            )}
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-3 bg-surface">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm no-underline ${
                pathname === link.href
                  ? "text-accent"
                  : "text-text-secondary"
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-border pt-3 flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm text-text-secondary no-underline"
              onClick={() => setMenuOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm text-accent no-underline"
              onClick={() => setMenuOpen(false)}
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
