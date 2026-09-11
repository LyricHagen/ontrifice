import type { Metadata } from "next";
import { Explorer } from "@/components/explore/explorer";
import type { GraphMode } from "@/components/explore/types";

export const metadata: Metadata = {
  title: "Graph",
  description:
    "Explore structural constraints between prediction markets. Search for a market to see its constraint neighborhood, or browse the full structural network.",
  openGraph: {
    title: "Graph | Ontrifice",
    description:
      "Interactive constraint explorer for cross-market prediction market relationships.",
    type: "website",
    url: "https://ontrifice.dev/graph",
  },
};

export const dynamic = "force-dynamic";

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const initialMode: GraphMode | undefined =
    params.mode === "browse" ? "browse" : undefined;

  return (
    <div style={{ height: "calc(100vh - 57px)", overflow: "hidden" }}>
      <Explorer
        focusMarketId={params.focus ?? null}
        initialMode={initialMode}
      />
    </div>
  );
}
