import { Skeleton } from "@/components/ui/misc";
export default function Loading() {
  return (
    <div className="grid h-[calc(100dvh-10rem)] gap-4 lg:grid-cols-[1fr_340px]">
      <Skeleton className="h-full rounded-[20px]" />
      <Skeleton className="hidden h-full rounded-[20px] lg:block" />
    </div>
  );
}
