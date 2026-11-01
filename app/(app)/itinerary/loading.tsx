import { Skeleton } from "@/components/ui/misc";
import { HeaderSkeleton } from "@/components/common/skeletons";
export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
        <Skeleton className="hidden h-[70vh] lg:col-span-5 lg:block" />
      </div>
    </div>
  );
}
