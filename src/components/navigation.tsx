"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/incoherences", label: "Incoherences" },
  { href: "/conditionals", label: "Model-Implied" },
  { href: "/cascades", label: "Cascades" },
  { href: "/docs", label: "Docs" },
];

function truncateEmail(email: string): string {
  if (email.length <= 24) return email;
  const at = email.indexOf("@");
  if (at <= 0) return email.slice(0, 24) + "...";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const truncated = local.length > 12 ? local.slice(0, 12) + "..." : local;
  return truncated + domain;
}

export function Navigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const isLoggedIn = status === "authenticated" && !!session?.user;

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
          {status === "loading" ? (
            <div className="w-16" />
          ) : isLoggedIn ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="text-sm text-text-secondary font-mono cursor-pointer bg-transparent border-none p-0 hover:text-foreground"
              >
                {truncateEmail(session?.user?.email ?? "")}
              </button>
              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 border border-border bg-surface py-1 min-w-[160px] z-50"
                  style={{ borderRadius: "2px" }}
                >
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-text-secondary no-underline hover:text-foreground hover:bg-surface-raised"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="block w-full text-left px-4 py-2 text-sm text-text-secondary cursor-pointer bg-transparent border-none hover:text-foreground hover:bg-surface-raised"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
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
            {isLoggedIn ? (
              <>
                <Link
                  href="/settings"
                  className="text-sm text-text-secondary no-underline"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="text-sm text-text-secondary cursor-pointer bg-transparent border-none p-0"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
