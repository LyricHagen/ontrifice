import type { Metadata } from "next";
import { Explorer } from "@/components/explore/explorer";

export const metadata: Metadata = {
  title: "Explore",
  description: "Interactive graph visualization of prediction market dependencies.",
};

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  return (
    <div style={{ height: "calc(100vh - 57px)", overflow: "hidden" }}>
      <Explorer />
    </div>
  );
}
