import { Loader2 } from "lucide-react";

export function Spinner({
  size = 22,
  className = "text-brand-500",
}: {
  size?: number;
  className?: string;
}) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}
