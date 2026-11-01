import { DatabaseZap } from "lucide-react";
import { EmptyState } from "./empty-state";

/** Shown when Phase 2 tables are missing (002_extras.sql not run yet). */
export function MigrationNotice() {
  return (
    <EmptyState
      icon={DatabaseZap}
      title="One more SQL step"
      description="This feature needs supabase/migrations/002_extras.sql. Open the Supabase SQL editor, paste the file, run it, then reload."
    />
  );
}
