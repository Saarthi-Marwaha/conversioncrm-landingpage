import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  change?: string;
}

export function MetricCard({ label, value, highlight, change }: MetricCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-5 space-y-1",
        highlight ? "border-sky-100" : "border-gray-100"
      )}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "text-3xl font-bold",
          highlight ? "text-sky-600" : "text-gray-900"
        )}
      >
        {value}
      </p>
      {change && (
        <p className="text-xs text-gray-400">{change}</p>
      )}
    </div>
  );
}
