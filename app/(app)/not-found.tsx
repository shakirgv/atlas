import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="This page wandered off"
      description="It may have been deleted, or it belongs to another trip."
      action={
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
