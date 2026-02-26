"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PROFILE_QUERY_KEY } from "./query-keys";

export interface AppProfile {
  username?: string;
  displayName?: string;
  gender?: string | null;
  birthDate?: string | null;
  occupation?: string | null;
  declaredMonthlyIncomeBand?: string | null;
  isAdmin?: boolean;
  accountLevel: number;
  accountXp: number;
  seasonLevel: number;
  seasonXp: number;
  ayumo: number;
  ryumo: number;
  streak: number;
  checkedInToday: boolean;
  accountXpNext?: number;
  accountXpPrev?: number;
  currentSeason?: {
    id: number;
    seasonNumber: number;
    name: string;
    startAt: string;
    endAt: string;
  } | null;
}

async function fetchProfileData(): Promise<AppProfile> {
  const res = await fetch("/api/user/profile", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Profile fetch failed");
  const d = await res.json();
  return {
    username: d.username,
    displayName: d.displayName,
    gender: d.gender ?? null,
    birthDate: d.birthDate ?? null,
    occupation: d.occupation ?? null,
    declaredMonthlyIncomeBand: d.declaredMonthlyIncomeBand ?? null,
    isAdmin: d.isAdmin === true,
    accountLevel: d.accountLevel ?? 1,
    accountXp: d.accountXp ?? 0,
    seasonLevel: d.seasonLevel ?? 1,
    seasonXp: d.seasonXp ?? 0,
    ayumo: Number(d.ayumo ?? 0) || 0,
    ryumo: Number(d.ryumo ?? 0) || 0,
    streak: d.streak ?? 0,
    checkedInToday: d.checkedInToday ?? false,
    accountXpNext: d.accountXpNext,
    accountXpPrev: d.accountXpPrev,
    currentSeason: d.currentSeason ?? null,
  };
}

function triggerLevelUpConfetti() {
  import("canvas-confetti").then(({ default: confetti }) => {
    confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 }, startVelocity: 35 });
    setTimeout(() => {
      confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
    }, 150);
  });
}

type ProfileContextValue = {
  profile: AppProfile | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function useAppProfile() {
  const ctx = useContext(ProfileContext);
  return ctx ?? { profile: null, loading: false, error: false, refresh: async () => {} };
}

export function AppProfileProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const prevLevelsRef = useRef<{ account: number; season: number } | null>(null);

  const { data: profile, isLoading: loading, isError } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfileData,
    refetchInterval: 8_000,
    staleTime: 5_000,
  });

  // Level atlama tespiti: her yeni veri gelişinde öncekiyle karşılaştır
  useEffect(() => {
    if (!profile) return;
    const prev = prevLevelsRef.current;
    if (
      prev !== null &&
      (profile.accountLevel > prev.account || profile.seasonLevel > prev.season)
    ) {
      triggerLevelUpConfetti();
    }
    prevLevelsRef.current = {
      account: profile.accountLevel,
      season: profile.seasonLevel,
    };
  }, [profile?.accountLevel, profile?.seasonLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
  }, [queryClient]);

  return (
    <ProfileContext.Provider
      value={{ profile: profile ?? null, loading, error: isError, refresh }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
