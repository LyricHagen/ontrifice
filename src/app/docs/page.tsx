import type { Metadata } from "next";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "REST API for computing collateral-efficient prediction market portfolios and querying proven cross-market relationships.",
  openGraph: {
    title: "API Documentation | Ontrifice",
    description: "REST API for computing collateral-efficient prediction market portfolios and querying proven cross-market relationships.",
    type: "website",
    url: "https://ontrifice.dev/docs",
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
