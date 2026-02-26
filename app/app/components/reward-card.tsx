"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import type { Reward } from "@/lib/receipt/types";

interface RewardCardProps {
  reward: Reward;
  /** When present (Honor path), show quality level and Honor Bonus 1.2x when applied */
  qualityHonor?: {
    level: string;
    honorDelta: number;
    rewardPct: number;
    honorBonusApplied: boolean;
    reasons: string[];
  };
}

export function RewardCard({ reward, qualityHonor }: RewardCardProps) {
  // Defensive defaults
  const ayumo = reward?.final ?? 0;
  const ryumo = reward?.ryumo != null ? Number(reward.ryumo) : 0;
  const totalReward = ayumo + ryumo;
  const rawReward = reward?.raw ?? 0;
  const conversionRate = reward?.conversionRate ?? 1;
  const token = reward?.token ?? "aYUMO";
  const capsApplied = reward?.capsApplied ?? [];

  return (
    <Card className="border-primary">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <CardTitle>Potansiyel Ödül</CardTitle>
        </div>
        <CardDescription>Gizli maliyetlerden kazanılan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide">Toplam ödül</p>
            <div className="text-4xl font-bold text-primary mb-3">
              {totalReward.toFixed(2)}
            </div>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span>aYUMO: <span className="font-medium text-foreground">{ayumo.toFixed(2)}</span></span>
              <span>rYUMO: <span className="font-medium text-emerald-600 dark:text-emerald-400">{ryumo.toFixed(2)}</span></span>
            </div>
            {qualityHonor?.honorBonusApplied && (
              <p className="text-sm text-primary mt-2 font-medium">Honor Bonus 1.2x uygulandı</p>
            )}
            {reward?.verifiedThankYou && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                İşletmeyi ilk siz yüklediniz; doğrulandığı için teşekkür bonusu (1.2x) uygulandı.
              </p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            {qualityHonor != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kalite</span>
                <span>{qualityHonor.level}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ham Ödül</span>
              <span>{rawReward.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dönüşüm Oranı</span>
              <span>{conversionRate.toFixed(2)}x</span>
            </div>
            {capsApplied.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Uygulanan Limitler:</p>
                {capsApplied.map((cap, i) => (
                  <Badge key={i} variant="outline" className="mr-1 text-xs">
                    {cap}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}






