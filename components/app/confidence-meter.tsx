"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  confidence: number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceMeter({
  confidence,
  showLabel = true,
  className,
}: ConfidenceMeterProps) {
  const getLabel = () => {
    if (confidence >= 80) return "Auto-verified";
    if (confidence >= 50) return "Needs confirmation";
    return "Low confidence";
  };

  const getColor = () => {
    if (confidence >= 80) return "bg-accent";
    if (confidence >= 50) return "bg-amber-500";
    return "bg-destructive";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-medium">{getLabel()}</span>
        </div>
      )}
      <Progress value={confidence} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{confidence}%</span>
        <span className={cn("px-2 py-0.5 rounded", getColor(), "opacity-20")}>
          {getLabel()}
        </span>
      </div>
    </div>
  );
}







