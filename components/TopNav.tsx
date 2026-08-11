"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BarChart3, Wallet, Users, Building2, Bell, Settings } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { RefreshButton } from "@/components/RefreshButton";

const NAV_ITEMS = [
  { href: "/", key: "dashboard" as const, icon: LayoutGrid },
  { href: "/analytics", key: "analytics" as const, icon: BarChart3 },
  { href: "/expenses", key: "expenses" as const, icon: Wallet },
  { href: "/crm", key: "crm" as const, icon: Users },
  { href: "/company", key: "company" as const, icon: Building2 },
];

export function TopNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <header className="flex flex-wrap items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-card sm:px-6">
      <Link href="/" className="flex items-center gap-2 pr-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-soft">
          U
        </div>
        <span className="hidden text-lg font-bold tracking-tight text-ink-900 sm:inline">
          UMMED <span className="text-brand-500">Analytics</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-wrap items-center gap-1 rounded-full bg-surface p-1">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:px-4 ${
                active
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-ink-500 hover:bg-white hover:text-ink-900"
              }`}
            >
              <Icon size={16} />
              <span className="hidden md:inline">{t.nav[key]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <RefreshButton />
        <LanguageSwitch />
        <button className="hidden h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-500 hover:text-ink-900 sm:flex">
          <Bell size={16} />
        </button>
        <button className="hidden h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-500 hover:text-ink-900 sm:flex">
          <Settings size={16} />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
          UM
        </div>
      </div>
    </header>
  );
}
