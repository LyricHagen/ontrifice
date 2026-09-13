import type { Metadata } from "next";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "REST API for computing true max loss on prediction market portfolios and querying proven structural constraints.",
  openGraph: {
    title: "API Documentation | Ontrifice",
    description: "REST API for computing true max loss on prediction market portfolios and querying proven structural constraints.",
    type: "website",
    url: "https://ontrifice.vercel.app/docs",
  },
};

export default function DocsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 flex">
      <DocsSidebar />
      <DocsContent />
    </div>
  );
}
