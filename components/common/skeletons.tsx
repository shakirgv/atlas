import { Skeleton } from "@/components/ui/misc";

export function HeaderSkeleton() {
  return (
    <div className="flex items-end justify-between pb-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="hidden h-10 w-36 sm:block" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      <HeaderSkeleton />
      <div className="mb-5 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="flex gap-3 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[280px] w-full rounded-[20px] sm:h-[340px]" />
      <div className="flex gap-3 border-b border-border pb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <HeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="card mt-6 divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-64 lg:col-span-7" />
        <div className="grid grid-cols-2 gap-4 lg:col-span-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
        <Skeleton className="h-80 lg:col-span-8" />
        <Skeleton className="h-80 lg:col-span-4" />
      </div>
    </div>
  );
}
