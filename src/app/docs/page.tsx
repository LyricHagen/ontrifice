import type { Metadata } from "next";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const metadata: Metadata = {
  title: "API Documentation",
};

export default function DocsPage() {
  return (
    <div className="max-w-7xl mx-auto flex">
      <DocsSidebar />
      <DocsContent />
    </div>
  );
}
