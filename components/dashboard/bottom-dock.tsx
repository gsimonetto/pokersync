"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  BookOpen,
  Users,
  Zap,
  Settings,
} from "lucide-react";

const DOCK_ITEMS = [
  { icon: Home, label: "Início", href: "/inicio" },
  { icon: BarChart3, label: "Performance", href: "/performance" },
  { icon: BookOpen, label: "Ranges", href: "/ranges" },
  { icon: Zap, label: "Treino", href: "/treino" },
  { icon: Users, label: "Time", href: "/time" },
  { icon: Settings, label: "Config", href: "/minha-conta" },
];

export function BottomDock() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="flex items-center justify-center gap-2 p-3 rounded-full border border-hairline/50 bg-elevated/80 backdrop-blur-2xl shadow-2xl pointer-events-auto">
        {DOCK_ITEMS.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center justify-center p-3 rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-review/20 border border-review/40"
                  : "hover:bg-surface/60 border border-transparent"
              }`}
              title={label}
            >
              <Icon
                size={20}
                className={`transition-colors ${
                  isActive ? "text-review" : "text-muted group-hover:text-ink"
                }`}
              />
              <span className="absolute bottom-full mb-2 px-2 py-1 rounded-md bg-elevated border border-hairline text-xs font-medium text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
