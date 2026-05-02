"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building, Sparkles, Send, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  building: Building,
  sparkles: Sparkles,
  send: Send,
};

interface SettingsNavItem {
  href: string;
  label: string;
  icon: string;
}

interface SettingsNavProps {
  items: SettingsNavItem[];
}

export function SettingsNav({ items }: SettingsNavProps) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors duration-100 ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
