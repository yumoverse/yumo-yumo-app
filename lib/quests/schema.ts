/**
 * Quest schema and enums for YUMO Yarisma (Faz 1).
 */

export type DailyQuestType = "D1" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "D9";
export type WeeklyQuestType = "W1A" | "W1B" | "W1C" | "W2" | "W3" | "W4" | "W5" | "W6";

export const DAILY_QUEST_TYPES: DailyQuestType[] = ["D1", "D3", "D4", "D5", "D6", "D7", "D8", "D9"];
export const WEEKLY_QUEST_TYPES: WeeklyQuestType[] = ["W1A", "W1B", "W1C", "W2", "W3", "W4", "W5", "W6"];

export interface UserQuest {
  id: number;
  username: string;
  questTemplateId: number;
  questType: string;
  status: "active" | "completed";
  progress: number;
  target: number;
  seasonNumber: number;
  expiresAt: string | null;
  completedAt: string | null;
  rewardRyumo: number;
  rewardSeasonXp: number;
  rewardAccountXp?: number;
  title: string;
}

export interface UserState {
  user7dAvgHiddenCost: number;
  userRecentMerchants: Set<string>;
  userRecentCategories: Set<string>;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ...
}
