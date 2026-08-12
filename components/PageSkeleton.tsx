import { Spinner } from "@/components/Spinner";

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none sticky top-24 z-10 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card">
          <Spinner size={16} />
        </div>
      </div>

      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-full bg-white/70" />
          <div className="h-4 w-80 rounded-full bg-white/50" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-white shadow-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-72 rounded-3xl bg-white shadow-card lg:col-span-2" />
          <div className="h-72 rounded-3xl bg-white shadow-card" />
        </div>
      </div>
    </div>
  );
}
