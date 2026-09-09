"use client";

import { useEffect, useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "rate-limiting", label: "Rate Limiting" },
  { id: "errors", label: "Errors" },
  { id: "get-api-markets", label: "GET /api/markets" },
  { id: "get-api-markets-id", label: "GET /api/markets/:id" },
  { id: "get-api-graph-edges", label: "GET /api/graph/edges" },
  { id: "get-api-graph-incoherences", label: "GET /api/graph/incoherences" },
  { id: "get-api-graph-conditionals", label: "GET /api/graph/conditionals" },
  { id: "get-api-graph-cascades", label: "GET /api/graph/cascades" },
  { id: "post-api-ingestion-trigger", label: "POST /api/ingestion/trigger" },
  { id: "post-api-graph-compute", label: "POST /api/graph/compute" },
  { id: "webhooks", label: "Webhooks" },
  { id: "client-libraries", label: "Client Libraries" },
];

export function DocsSidebar() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <aside className="hidden lg:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border py-8 px-4">
      <p className="text-xs font-mono text-muted uppercase tracking-wider mb-4">
        Contents
      </p>
      <nav className="flex flex-col gap-1">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`text-sm no-underline py-1 ${
              activeId === section.id
                ? "text-accent"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            {section.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
