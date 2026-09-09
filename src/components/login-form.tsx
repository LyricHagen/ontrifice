"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "@/lib/auth-actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    if (redirectTo) {
      formData.set("redirectTo", redirectTo);
    }

    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError(
        "Could not log you in due to a server error. This is not your fault. Try again in a moment. (ERR_AUTH_LOGIN_SERVER)",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-[400px] mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold font-mono mb-8">Log in</h1>

      {error && (
        <div
          className="border border-error-border bg-error-bg px-3 py-2.5 text-sm text-error mb-6"
          style={{ borderRadius: "2px" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm text-text-secondary mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full px-3 py-2 bg-surface border border-border text-foreground text-sm"
            style={{ borderRadius: "2px" }}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm text-text-secondary mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 bg-surface border border-border text-foreground text-sm"
            style={{ borderRadius: "2px" }}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-border text-foreground text-sm font-mono cursor-pointer hover:border-accent hover:text-accent disabled:opacity-50"
          style={{ borderRadius: "2px" }}
        >
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="text-sm text-text-secondary mt-6 text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}
