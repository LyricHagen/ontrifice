"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/lib/auth-actions";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(
        "Enter a valid email address. Example: you@domain.com (ERR_VALIDATION_EMAIL)",
      );
      return;
    }

    if (password.length < 8) {
      setError(
        `Password must be at least 8 characters. Yours is ${password.length}. (ERR_VALIDATION_PASSWORD_LENGTH)`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match. Re-enter your password in both fields. (ERR_VALIDATION_PASSWORD_MISMATCH)",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signup(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError(
        "Could not create your account due to a server error. This is not your fault. Try again in a moment, and if it persists, contact support. (ERR_AUTH_SIGNUP_SERVER)",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-[400px] mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold font-mono mb-8">Sign up</h1>

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
            autoComplete="new-password"
            className="w-full px-3 py-2 bg-surface border border-border text-foreground text-sm"
            style={{ borderRadius: "2px" }}
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm text-text-secondary mb-1.5"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
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
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-sm text-text-secondary mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
