"use client";

import { useLanguage } from "@/lib/i18n/context";

export function LanguageSwitch() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center rounded-full bg-surface p-1 text-xs font-semibold">
      {(["uz", "ru"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded-full px-2.5 py-1.5 uppercase transition-colors ${
            locale === l ? "bg-brand-500 text-white shadow-soft" : "text-ink-500 hover:text-ink-900"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
