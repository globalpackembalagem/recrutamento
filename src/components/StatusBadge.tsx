import { statusLabels, statusColors, type StatusEtapa } from "@/lib/supabaseData";
import { cn } from "@/lib/utils";

export default function StatusBadge({ status }: { status: StatusEtapa }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        statusColors[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
