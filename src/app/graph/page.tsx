import type { Metadata } from "next";
import { Explorer } from "@/components/explore/explorer";

export const metadata: Metadata = {
  title: "Graph",
  description:
    "Interactive visualization of the cross-market relationship network. Browse structural constraints between prediction markets.",
  openGraph: {
    title: "Graph | Ontrifice",
    description:
      "Visual browser for the prediction market relationship network.",
    type: "website",
    url: "https://ontrifice.dev/graph",
  },
};

export const dynamic = "force-dynamic";

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const params = await searchParams;

  return (
    <div style={{ height: "calc(100vh - 57px)", overflow: "hidden" }}>
      <Explorer focusMarketId={params.focus ?? null} />
    </div>
  );
}
