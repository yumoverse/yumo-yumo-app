"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useMounted } from "@/lib/hooks/use-mounted";

export function AppLanguageSelector() {
  const { locale, setLocale } = useAppLocale();
  const mounted = useMounted();

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="gap-2"
    >
      <Globe className="h-4 w-4" />
    </Button>
  );

  if (!mounted) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem
          onClick={() => setLocale('en')}
          className={`cursor-pointer ${locale === 'en' ? 'bg-gray-100 dark:bg-gray-800 text-foreground font-semibold' : 'text-foreground'}`}
        >
          🇬🇧 English
          {locale === 'en' && <span className="ml-auto text-xs text-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale('tr')}
          className={`cursor-pointer ${locale === 'tr' ? 'bg-gray-100 dark:bg-gray-800 text-foreground font-semibold' : 'text-foreground'}`}
        >
          🇹🇷 Türkçe
          {locale === 'tr' && <span className="ml-auto text-xs text-foreground">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
