interface SkeletonProps {
  rows?: number;
  widths?: string[];
}

export function Skeleton({ rows = 3, widths }: SkeletonProps) {
  const defaultWidths = ["100%", "80%", "60%", "90%", "70%"];

  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-surface-raised animate-pulse"
          style={{
            width: widths?.[i] ?? defaultWidths[i % defaultWidths.length],
            borderRadius: "2px",
          }}
        />
      ))}
    </div>
  );
}
