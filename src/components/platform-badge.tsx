import type { Platform } from "@/types";
import { PLATFORM_CONFIG } from "@/types";

export function PlatformBadge({ platform }: { platform: Platform }) {
  const config = PLATFORM_CONFIG[platform];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${config.badgeColor}`}
    >
      {config.label}
    </span>
  );
}
