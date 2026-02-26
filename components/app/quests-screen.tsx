"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeCard } from "@/components/app/theme-card";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QUESTS_DAILY_QUERY_KEY, PROFILE_QUERY_KEY } from "@/lib/app/query-keys";

function fireQuestConfetti() {
  import("canvas-confetti").then(({ default: confetti }) => {
    confetti({
      particleCount: 90,
      spread: 65,
      origin: { y: 0.55 },
      colors: ["#C9A84C", "#E8C97A", "#34D399", "#F0F0FF", "#60A5FA"],
      startVelocity: 32,
      gravity: 0.9,
    });
    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 50,
        origin: { x: 0, y: 0.6 },
        colors: ["#C9A84C", "#E8C97A", "#34D399"],
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 50,
        origin: { x: 1, y: 0.6 },
        colors: ["#C9A84C", "#E8C97A", "#34D399"],
      });
    }, 150);
  });
}

/** Renk paleti: görev sırasına göre döngü — referans DS değerleriyle */
const QUEST_COLORS = ["#34D399", "#C9A84C", "#60A5FA", "#A78BFA", "#F87171"];

interface QuestVisualCardProps {
  quest: {
    id: number;
    title: string;
    progress: number;
    target: number;
    status: string;
    rewardRyumo: number;
    rewardSeasonXp: number;
  };
  color: string;
  accountLevel?: number;
}

/** Görev durumu badge'i */
function StatusBadge({ status, color }: { status: string; color: string }) {
  const cfg =
    status === "completed"
      ? { label: "TAMAMLANDI", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.25)", text: "#34D399" }
      : status === "active"
      ? { label: "AKTİF", bg: "var(--app-gold-glow,rgba(201,168,76,0.15))", border: "var(--app-gold-border,rgba(201,168,76,0.18))", text: "var(--app-gold,#C9A84C)" }
      : { label: "KİLİTLİ", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "var(--app-text-muted)" };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

/** Dairesel SVG ilerleme göstergeli görev kartı — referans tasarım */
function QuestVisualCard({
  quest,
  color,
  accountLevel = 1,
}: QuestVisualCardProps) {
  const pct = quest.target > 0 ? Math.min(quest.progress / quest.target, 1) : 1;
  const done = quest.status === "completed";
  const locked = quest.status === "locked";

  const RADIUS = 18;
  const CIRC = 2 * Math.PI * RADIUS;
  const ringColor = done ? "#34D399" : locked ? "var(--app-text-muted)" : color;

  return (
    <ThemeCard accountLevel={accountLevel}>
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        {/* Dairesel ilerleme */}
        <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
          <svg width={44} height={44} style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={22} cy={22} r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={3}
            />
            <circle
              cx={22} cy={22} r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct)}
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center font-bold tabular-nums"
            style={{
              fontSize: done ? 14 : 10,
              color: ringColor,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {done ? "✓" : locked ? "🔒" : `${Math.round(pct * 100)}%`}
          </div>
        </div>

        {/* Başlık + durum + ilerleme */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p
              className="text-[13px] font-semibold leading-tight"
              style={{
                color: done || locked ? "var(--app-text-muted)" : "var(--app-text-primary)",
                textDecoration: done ? "line-through" : "none",
              }}
            >
              {quest.title}
            </p>
            <StatusBadge status={quest.status} color={color} />
          </div>
          <p className="text-[11px]" style={{ color: "var(--app-text-muted)" }}>
            {quest.progress} / {quest.target}
            {" · "}
            <span style={{ color: done ? "var(--app-text-muted)" : "#34D399" }}>
              +{quest.rewardSeasonXp} XP
            </span>
          </p>
        </div>

        {/* Ödül */}
        <div className="text-right flex-shrink-0">
          <p
            className="font-mono text-[15px] font-bold tabular-nums"
            style={{ color: done || locked ? "var(--app-text-muted)" : color }}
          >
            +{quest.rewardRyumo}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "var(--app-text-muted)" }}>
            rYUMO
          </p>
        </div>
      </div>
    </ThemeCard>
  );
}

function WeeklyQuestBlock({ accountLevel }: { accountLevel?: number }) {
  const { t } = useAppLocale();
  const [weekly, setWeekly] = useState<{ title: string; progress: number; target: number; status: string; rewardRyumo: number; rewardSeasonXp: number } | null>(null);
  const [options, setOptions] = useState<{ type: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quests/weekly")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.weekly) setWeekly({ ...d.weekly });
        if (d?.options?.length) setOptions(d.options.map((o: any) => ({ type: o.type, title: o.title })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ThemeCard accountLevel={accountLevel}><div className="p-4 h-16 animate-pulse rounded bg-muted/50" /></ThemeCard>;
  if (weekly) {
    const pct = weekly.target > 0 ? Math.min((weekly.progress / weekly.target) * 100, 100) : 0;
    const done = weekly.status === "completed";
    return (
      <ThemeCard accountLevel={accountLevel}>
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>{weekly.title}</p>
            {done && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-400">
                {t("quests.completedBadge")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {weekly.rewardRyumo} rYUMO · {weekly.rewardSeasonXp} XP
          </div>
          {!done && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--app-gold,#C9A84C)", transition: "width 0.6s ease" }} />
            </div>
          )}
        </div>
      </ThemeCard>
    );
  }
  if (options.length > 0) {
    return (
      <ThemeCard accountLevel={accountLevel}>
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-2">{t("quests.selectGoalThisWeek")}</p>
          <p className="text-xs text-muted-foreground">POST /api/quests/weekly/select</p>
        </div>
      </ThemeCard>
    );
  }
  return <ThemeCard accountLevel={accountLevel}><div className="p-4"><p className="text-sm text-muted-foreground">{t("quests.noWeeklyGoal")}</p></div></ThemeCard>;
}

interface DailyQuest {
  id: number;
  type: string;
  title: string;
  progress: number;
  target: number;
  status: string;
  rewardRyumo: number;
  rewardSeasonXp: number;
}

interface QuestsScreenProps {
  accountLevel?: number;
  className?: string;
  /** Değiştiğinde günlük görevler yeniden çekilir (örn. check-in sonrası). */
  refreshKey?: number;
  /** Ana ekran önizleme modu: sadece ilk 2 görev + "tüm görevler" linki */
  preview?: boolean;
}

/** Şu anki günü GMT/UTC tarih string'i olarak döner (YYYY-MM-DD). */
function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Bir sonraki GMT gece yarısına (00:00:00.000Z) kalan ms. */
function msUntilNextMidnightUTC(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime() - now.getTime();
}

interface DailyQuestsData {
  quests: DailyQuest[];
  totalRyumo: number;
  totalSeasonXp: number;
  date: string | null;
}

async function fetchDailyQuests(): Promise<DailyQuestsData> {
  const res = await fetch("/api/quests/daily", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed");
  const data = await res.json();
  return {
    quests: data.quests ?? [],
    totalRyumo: data.totalRyumo ?? 0,
    totalSeasonXp: data.totalSeasonXp ?? 0,
    date: data.date ?? null,
  };
}

export function QuestsScreen({ accountLevel = 1, className, refreshKey = 0, preview = false }: QuestsScreenProps) {
  const { t } = useAppLocale();
  const queryClient = useQueryClient();

  /** Oturumda zaten auto-complete edilmiş quest id'leri — çift tetiklemeyi önler */
  const autoCompletedRef = useRef(new Set<number>());
  const prevQuestDateRef = useRef<string | null>(null);
  const prevRefreshKeyRef = useRef(refreshKey);

  const { data, isLoading: loading, isError } = useQuery({
    queryKey: QUESTS_DAILY_QUERY_KEY,
    queryFn: fetchDailyQuests,
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  const daily = data?.quests ?? [];
  const totalRyumo = data?.totalRyumo ?? 0;
  const totalSeasonXp = data?.totalSeasonXp ?? 0;
  const questDate = data?.date ?? null;
  const error = isError ? "quests.loadError" : null;

  // refreshKey değişince (check-in sonrası vb.) sorguyu yenile
  useEffect(() => {
    if (refreshKey !== prevRefreshKeyRef.current) {
      prevRefreshKeyRef.current = refreshKey;
      queryClient.invalidateQueries({ queryKey: QUESTS_DAILY_QUERY_KEY });
    }
  }, [refreshKey, queryClient]);

  // Yeni gün gelince autoCompletedRef temizle
  useEffect(() => {
    if (prevQuestDateRef.current && questDate && prevQuestDateRef.current !== questDate) {
      autoCompletedRef.current.clear();
    }
    prevQuestDateRef.current = questDate;
  }, [questDate]);

  const handleCompleteQuest = useCallback(
    async (questId: number): Promise<{ levelUp?: "account" | "season" | "both" | null } | null> => {
      try {
        const res = await fetch("/api/quests/daily/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ questId }),
        });
        const resData = await res.json();
        if (!res.ok) return null;
        // Hem görevleri hem profili anında yenile
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: QUESTS_DAILY_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
        ]);
        return { levelUp: resData.levelUp ?? null };
      } catch {
        return null;
      }
    },
    [queryClient]
  );

  /** progress >= target olan aktif görevleri otomatik tamamla ve konfeti patlat */
  useEffect(() => {
    if (loading || daily.length === 0) return;
    const completable = daily.filter(
      (q) =>
        q.status === "active" &&
        q.progress >= q.target &&
        !autoCompletedRef.current.has(q.id)
    );
    if (completable.length === 0) return;
    completable.forEach((q) => autoCompletedRef.current.add(q.id));
    Promise.all(completable.map((q) => handleCompleteQuest(q.id))).then((results) => {
      if (results.some((r) => r !== null)) {
        fireQuestConfetti();
      }
    });
  }, [daily, loading, handleCompleteQuest]);

  // GMT gece yarısı UTC'de otomatik yenile
  useEffect(() => {
    const delay = msUntilNextMidnightUTC() + 60 * 1000;
    const timer = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: QUESTS_DAILY_QUERY_KEY }),
      Math.min(delay, 24 * 60 * 60 * 1000)
    );
    return () => clearTimeout(timer);
  }, [questDate, queryClient]);

  // Sayfa açıkken gün değiştiyse tarih eski kalmasın
  useEffect(() => {
    if (!questDate || daily.length === 0) return;
    const today = getTodayUTC();
    if (questDate !== today) {
      queryClient.invalidateQueries({ queryKey: QUESTS_DAILY_QUERY_KEY });
    }
    const interval = setInterval(() => {
      if (getTodayUTC() !== questDate) {
        queryClient.invalidateQueries({ queryKey: QUESTS_DAILY_QUERY_KEY });
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [questDate, daily.length, queryClient]);

  const today = getTodayUTC();
  const isStaleDate = questDate != null && questDate !== today;
  const showDaily = !isStaleDate && daily.length > 0;
  const showEmpty = !isStaleDate && daily.length === 0 && !loading;

  // Preview modda gösterilecek görevler
  const visibleQuests = preview ? daily.slice(0, 2) : daily;

  // Önceki günün verisi varsa hemen bugünü çek
  useEffect(() => {
    if (isStaleDate) queryClient.invalidateQueries({ queryKey: QUESTS_DAILY_QUERY_KEY });
  }, [isStaleDate, queryClient]);

  if (loading || isStaleDate) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="h-16 animate-pulse rounded-xl" style={{ background: "var(--app-bg-elevated)" }} />
        {!preview && <div className="h-16 animate-pulse rounded-xl" style={{ background: "var(--app-bg-elevated)" }} />}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center py-8", className)} style={{ color: "var(--app-text-muted)" }}>
        {error === "quests.loadError" ? t("quests.loadError") : error}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Başlık satırı */}
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--app-text-muted)" }}
        >
          {t("quests.dailyTitle")}
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className="font-mono text-[12px] font-bold tabular-nums"
            style={{ color: "var(--app-gold, #C9A84C)" }}
          >
            {totalRyumo} rYUMO
          </span>
          <span className="text-[11px]" style={{ color: "var(--app-text-muted)" }}>
            · +{totalSeasonXp} XP
          </span>
        </div>
      </div>

      {showEmpty ? (
        <ThemeCard accountLevel={accountLevel}>
          <div className="p-4">
            <p className="text-center text-sm" style={{ color: "var(--app-text-muted)" }}>
              {t("quests.noDailyQuests")}
            </p>
          </div>
        </ThemeCard>
      ) : showDaily ? (
        <div className="space-y-2">
          {visibleQuests.map((q, i) => (
            <QuestVisualCard
              key={q.id}
              quest={q}
              color={QUEST_COLORS[i % QUEST_COLORS.length]}
              accountLevel={accountLevel}
            />
          ))}
        </div>
      ) : null}

      {/* Preview modda "tüm görevler" linki */}
      {preview && daily.length > 0 && (
        <Link
          href="/app/tasks"
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-[12px] font-semibold transition-opacity hover:opacity-80"
          style={{
            color: "var(--app-text-muted)",
            border: "1px solid rgba(255,255,255,0.07)",
            background: "transparent",
          }}
        >
          Tüm görevlere git
          <span style={{ fontSize: 14 }}>→</span>
        </Link>
      )}
    </div>
  );
}
