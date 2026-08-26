"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, BarChart3, Wallet, Users, Building2, Boxes } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { RefreshButton } from "@/components/RefreshButton";

const NAV_ITEMS = [
  { href: "/", key: "dashboard" as const, icon: LayoutGrid },
  { href: "/analytics", key: "analytics" as const, icon: BarChart3 },
  { href: "/warehouse", key: "warehouse" as const, icon: Boxes },
  { href: "/expenses", key: "expenses" as const, icon: Wallet },
  { href: "/crm", key: "crm" as const, icon: Users },
  { href: "/company", key: "company" as const, icon: Building2 },
];

export function TopNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <header className="flex flex-wrap items-center gap-3 rounded-3xl bg-white px-3 py-3 shadow-card sm:px-6">
      <Link href="/" className="order-1 flex items-center gap-2 pr-2">
        <Image src="/logo.png" alt="Ummed" width={36} height={36} className="h-9 w-9 shrink-0 rounded-2xl shadow-soft" priority />
        <span className="hidden text-lg font-bold tracking-tight text-ink-900 sm:inline">
          UMMED <span className="text-brand-500">Analytics</span>
        </span>
      </Link>

      <nav className="no-scrollbar order-3 grid w-full grid-cols-6 gap-1 rounded-full bg-surface p-1 sm:order-2 sm:flex sm:w-auto sm:flex-1 sm:items-center sm:overflow-x-auto">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium transition-colors sm:px-3.5 sm:justify-start md:px-4 ${
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

      <div className="order-2 ml-auto flex items-center gap-2 sm:order-3 sm:ml-0">
        <RefreshButton />
        <LanguageSwitch />
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
          UM
        </div>
      </div>
    </header>
  );
}
