import type { Metadata } from "next";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "REST API documentation for querying the Ontrifice prediction market dependency graph.",
  openGraph: {
    title: "API Documentation | Ontrifice",
    description: "REST API documentation for querying the Ontrifice prediction market dependency graph.",
    type: "website",
    url: "https://ontrifice.dev/docs",
  },
};

export default function DocsPage() {
  return (
    <div className="max-w-7xl mx-auto flex">
      <DocsSidebar />
      <DocsContent />
    </div>
  );
}
