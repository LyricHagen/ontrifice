import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation",
};

export default function DocsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold font-mono mb-4">API Documentation</h1>
      <p className="text-text-secondary">Coming soon.</p>
    </div>
  );
}
