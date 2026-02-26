"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, Plus, Sparkles } from "lucide-react";

interface TestQuestState {
  hasQuest: boolean;
  questId?: number;
  status?: string;
  progress?: number;
  target?: number;
  rewardRyumo?: number;
  rewardSeasonXp?: number;
}

export default function AdminQuestTestPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TestQuestState | null>(null);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState<string | null>(null);

  const fetchState = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/quest-test", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setState({
          hasQuest: data.hasQuest ?? false,
          questId: data.questId,
          status: data.status,
          progress: data.progress,
          target: data.target,
          rewardRyumo: data.rewardRyumo,
          rewardSeasonXp: data.rewardSeasonXp,
        });
      } else {
        setState({ hasQuest: false });
      }
    } catch {
      setState({ hasQuest: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setCompleteResult(null);
    try {
      const res = await fetch("/api/admin/quest-test", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        await fetchState();
        setCompleteResult(data.created ? "Test görevi oluşturuldu (180 XP, tamamlanmış)." : "Test görevi zaten vardı.");
      } else {
        setCompleteResult("Hata: " + (data.error || res.statusText));
      }
    } catch (e) {
      setCompleteResult("Hata: " + String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async () => {
    if (!state?.questId) return;
    setCompleting(true);
    setCompleteResult(null);
    try {
      const res = await fetch("/api/quests/daily/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questId: state.questId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompleteResult(
          data.ok
            ? `Tamamla API başarılı. levelUp=${data.levelUp ?? "yok"} accountLevel=${data.accountLevel} seasonLevel=${data.seasonLevel}`
            : `Tamamla API: ok=false`
        );
      } else {
        setCompleteResult(`HTTP ${res.status}: ${data.error ?? "Unknown"} ${data.ok === false ? "(zaten tamamlanmış olabilir)" : ""}`);
      }
    } catch (e) {
      setCompleteResult("Hata: " + String(e));
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Yükleniyor...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-xl space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/app/admin/analyze-file" className="text-sm text-muted-foreground hover:underline">
            ← Admin
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Test: 180 XP tamamlanmış görev
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bu sayfa 180 XP ödüllü bir test görevi oluşturur (şartlar karşılanmış: progress=1, target=1).
              &quot;Tamamla&quot;a basınca ödül verilir ve API cevabı (levelUp vb.) aşağıda görünür.
            </p>

            {!state?.hasQuest ? (
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-2">Test görevini oluştur</span>
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Test görevi mevcut</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  ID: {state.questId} · Durum: {state.status} · +{state.rewardSeasonXp ?? 180} XP
                </div>
                <Button variant="default" onClick={handleComplete} disabled={completing}>
                  {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span className="ml-2">Tamamlaya bas (test)</span>
                </Button>
              </div>
            )}

            {completeResult != null && (
              <pre className="text-xs rounded bg-muted p-3 whitespace-pre-wrap break-words">
                {completeResult}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
