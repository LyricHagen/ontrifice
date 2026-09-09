import type { Metadata } from "next";
import { Explorer } from "@/components/explore/explorer";

export const metadata: Metadata = {
  title: "Explore",
  description: "Interactive graph visualization of prediction market dependencies.",
  openGraph: {
    title: "Explore | Ontrifice",
    description: "Interactive graph visualization of prediction market dependencies.",
    type: "website",
    url: "https://ontrifice.dev/explore",
  },
};

export const dynamic = "force-dynamic";

export default async function ExplorePage({
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
