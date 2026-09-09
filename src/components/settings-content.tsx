"use client";

import { useState, useRef } from "react";
import {
  deleteAccount,
  generateApiKey,
  revokeApiKey,
} from "@/lib/auth-actions";

export function SettingsContent({
  email,
  hasApiKey,
  apiKeyCreatedAt,
}: {
  email: string;
  hasApiKey: boolean;
  apiKeyCreatedAt: string | null;
}) {
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [apiKeyState, setApiKeyState] = useState({
    exists: hasApiKey,
    createdAt: apiKeyCreatedAt,
  });
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const revokeDialogRef = useRef<HTMLDialogElement>(null);

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const result = await deleteAccount();
      if (result?.error) {
        setError(result.error);
        deleteDialogRef.current?.close();
      }
    } catch {
      setError(
        "Could not delete your account due to a server error. Try again in a moment.",
      );
      deleteDialogRef.current?.close();
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleGenerateApiKey() {
    setIsGenerating(true);
    setError(null);
    setGeneratedKey(null);
    try {
      const result = await generateApiKey();
      if ("error" in result) {
        setError(result.error);
      } else {
        setGeneratedKey(result.key);
        setApiKeyState({
          exists: true,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      setError("Could not generate API key. Try again in a moment.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRevokeApiKey() {
    setIsRevoking(true);
    setError(null);
    try {
      const result = await revokeApiKey();
      if (result?.error) {
        setError(result.error);
      } else {
        setApiKeyState({ exists: false, createdAt: null });
        setGeneratedKey(null);
      }
    } catch {
      setError("Could not revoke API key. Try again in a moment.");
    } finally {
      setIsRevoking(false);
      revokeDialogRef.current?.close();
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="max-w-[640px] mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold font-mono mb-10">Settings</h1>

      {error && (
        <div
          className="border border-error-border bg-error-bg px-3 py-2.5 text-sm text-error mb-6"
          style={{ borderRadius: "2px" }}
        >
          {error}
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-mono text-muted uppercase tracking-wider mb-4">
          Account
        </h2>
        <div
          className="border border-border"
          style={{ borderRadius: "2px" }}
        >
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <div>
              <div className="text-xs text-text-secondary uppercase tracking-wider">
                Email
              </div>
              <div className="text-sm font-mono mt-0.5">{email}</div>
            </div>
          </div>
          <div className="px-4 py-3">
            <button
              onClick={() => deleteDialogRef.current?.showModal()}
              className="text-sm text-error cursor-pointer bg-transparent border-none p-0"
              aria-label="Delete your account"
            >
              Delete account
            </button>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono text-muted uppercase tracking-wider mb-4">
          API Key
        </h2>
        <div
          className="border border-border"
          style={{ borderRadius: "2px" }}
        >
          {generatedKey ? (
            <div className="px-4 py-3">
              <div className="text-sm text-text-secondary mb-2">
                Copy this key now. It will not be shown again. If you lose
                it, you&apos;ll need to regenerate.
              </div>
              <div
                className="bg-surface-raised px-3 py-2 font-mono text-sm break-all select-all"
                style={{ borderRadius: "2px" }}
              >
                {generatedKey}
              </div>
              <button
                onClick={() => setGeneratedKey(null)}
                className="text-sm text-text-secondary mt-3 cursor-pointer bg-transparent border-none p-0 hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          ) : apiKeyState.exists ? (
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="text-sm">
                API key active
                {apiKeyState.createdAt && (
                  <span className="text-text-secondary">
                    {" "}
                    (created {formatDate(apiKeyState.createdAt)})
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateApiKey}
                  disabled={isGenerating}
                  className="text-sm text-accent cursor-pointer bg-transparent border-none p-0 disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => revokeDialogRef.current?.showModal()}
                  disabled={isRevoking}
                  className="text-sm text-error cursor-pointer bg-transparent border-none p-0 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3">
              <button
                onClick={handleGenerateApiKey}
                disabled={isGenerating}
                className="text-sm px-3 py-1.5 border border-border text-foreground font-mono cursor-pointer hover:border-accent hover:text-accent disabled:opacity-50"
                style={{ borderRadius: "2px" }}
              >
                {isGenerating ? "Generating..." : "Generate API key"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono text-muted uppercase tracking-wider mb-4">
          API Usage
        </h2>
        <div
          className="border border-border px-4 py-3"
          style={{ borderRadius: "2px" }}
        >
          <p className="text-sm text-text-secondary">
            API usage tracking coming soon.
          </p>
        </div>
      </section>

      <dialog
        ref={deleteDialogRef}
        className="bg-background text-foreground border border-border p-6 max-w-md w-full"
        style={{ borderRadius: "2px" }}
      >
        <h3 className="text-base font-bold font-mono mb-3">
          Delete account
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          This will permanently delete your account, API key, and all
          associated data. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => deleteDialogRef.current?.close()}
            className="text-sm px-3 py-1.5 border border-border text-foreground font-mono cursor-pointer"
            style={{ borderRadius: "2px" }}
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="text-sm px-3 py-1.5 border border-error text-error font-mono cursor-pointer disabled:opacity-50"
            style={{ borderRadius: "2px" }}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </dialog>

      <dialog
        ref={revokeDialogRef}
        className="bg-background text-foreground border border-border p-6 max-w-md w-full"
        style={{ borderRadius: "2px" }}
      >
        <h3 className="text-base font-bold font-mono mb-3">
          Revoke API key
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          This will permanently revoke your API key. Any integrations using
          this key will stop working immediately.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => revokeDialogRef.current?.close()}
            className="text-sm px-3 py-1.5 border border-border text-foreground font-mono cursor-pointer"
            style={{ borderRadius: "2px" }}
          >
            Cancel
          </button>
          <button
            onClick={handleRevokeApiKey}
            disabled={isRevoking}
            className="text-sm px-3 py-1.5 border border-error text-error font-mono cursor-pointer disabled:opacity-50"
            style={{ borderRadius: "2px" }}
          >
            {isRevoking ? "Revoking..." : "Revoke"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
