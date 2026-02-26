"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Building2, 
  Users, 
  FileCheck, 
  TrendingUp, 
  Truck, 
  Calculator,
  MapPin,
  CheckCircle2
} from "lucide-react";

interface AnalysisStep {
  id: string;
  labelTr: string;
  labelEn: string;
  descTr: string;
  descEn: string;
  icon: React.ReactNode;
  progress: number;
}

interface DeepScanAnalyzerProps {
  isActive: boolean;
  onComplete?: () => void;
  estimatedDuration?: number;
  actualProgress?: number;
  locale?: string;
}

const analysisSteps: AnalysisStep[] = [
  { 
    id: "location",
    labelTr: "İşletme yeri tespit ediliyor",
    labelEn: "Detecting business location",
    descTr: "Coğrafi konum analiz ediliyor",
    descEn: "Analyzing geographic location",
    icon: <MapPin className="w-4 h-4" />,
    progress: 12,
  },
  { 
    id: "rent",
    labelTr: "Kira maliyetleri hesaplanıyor",
    labelEn: "Calculating rent costs",
    descTr: "Bölgesel kira endeksleri karşılaştırılıyor",
    descEn: "Comparing regional rent indices",
    icon: <Building2 className="w-4 h-4" />,
    progress: 25,
  },
  { 
    id: "employees",
    labelTr: "Çalışan masrafları analiz ediliyor",
    labelEn: "Analyzing employee costs",
    descTr: "Personel giderleri hesaplanıyor",
    descEn: "Calculating personnel expenses",
    icon: <Users className="w-4 h-4" />,
    progress: 40,
  },
  { 
    id: "supply",
    labelTr: "Tedarik zincirleri taranıyor",
    labelEn: "Scanning supply chains",
    descTr: "Lojistik maliyetler analiz ediliyor",
    descEn: "Analyzing logistics costs",
    icon: <Truck className="w-4 h-4" />,
    progress: 55,
  },
  { 
    id: "taxes",
    labelTr: "Görünmeyen vergiler çıkartılıyor",
    labelEn: "Extracting hidden taxes",
    descTr: "KDV ve dolaylı vergiler hesaplanıyor",
    descEn: "Calculating VAT and indirect taxes",
    icon: <Calculator className="w-4 h-4" />,
    progress: 70,
  },
  { 
    id: "margins",
    labelTr: "Kar marjları hesaplanıyor",
    labelEn: "Calculating profit margins",
    descTr: "Perakende fiyat farklılıkları",
    descEn: "Retail price differences",
    icon: <TrendingUp className="w-4 h-4" />,
    progress: 85,
  },
  { 
    id: "finalize",
    labelTr: "Rapor oluşturuluyor",
    labelEn: "Generating report",
    descTr: "Gizli maliyet raporu hazırlanıyor",
    descEn: "Preparing hidden cost report",
    icon: <FileCheck className="w-4 h-4" />,
    progress: 100,
  }
];

export function DeepScanAnalyzer({
  isActive,
  onComplete,
  estimatedDuration = 23000,
  actualProgress,
  locale = "en"
}: DeepScanAnalyzerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const startTimeRef = useRef<number | null>(null);

  // Track completed steps with ref to avoid re-renders causing infinite loop
  const completedStepsRef = useRef<Set<string>>(new Set());
  const onCompleteRef = useRef(onComplete);
  
  // Keep onComplete ref up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Main progress loop - only depends on isActive, actualProgress, estimatedDuration
  useEffect(() => {
    if (!isActive) {
      startTimeRef.current = null;
      completedStepsRef.current = new Set();
      setProgress(0);
      setCurrentStepIndex(0);
      setCompletedSteps([]);
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      if (actualProgress !== undefined && actualProgress >= 100) {
        setProgress(100);
        setCurrentStepIndex(analysisSteps.length - 1);
        setCompletedSteps(analysisSteps.map(s => s.id));
        clearInterval(interval);
        setTimeout(() => onCompleteRef.current?.(), 1000);
        return;
      }

      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const timeBasedProgress = Math.min((elapsed / estimatedDuration) * 85, 85);
      
      const effectiveProgress = actualProgress !== undefined && actualProgress > 85 
        ? actualProgress 
        : timeBasedProgress;

      setProgress(effectiveProgress);

      // Find current step and update completed steps
      let newStepIndex = 0;
      const newCompletedSteps: string[] = [];
      
      for (let i = 0; i < analysisSteps.length; i++) {
        if (effectiveProgress >= analysisSteps[i].progress) {
          newStepIndex = i;
          newCompletedSteps.push(analysisSteps[i].id);
        } else {
          break;
        }
      }

      // Only update state if there are actual changes
      setCurrentStepIndex(prev => prev !== newStepIndex ? newStepIndex : prev);
      
      // Check if completed steps changed using the ref
      const hasNewSteps = newCompletedSteps.some(id => !completedStepsRef.current.has(id));
      if (hasNewSteps) {
        newCompletedSteps.forEach(id => completedStepsRef.current.add(id));
        setCompletedSteps([...completedStepsRef.current]);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, actualProgress, estimatedDuration]);

  if (!isActive) return null;

  const currentStep = analysisSteps[currentStepIndex];
  const label = locale === "tr" ? currentStep.labelTr : currentStep.labelEn;
  const desc = locale === "tr" ? currentStep.descTr : currentStep.descEn;

  const texts = {
    tr: { demo: "DEMO", title: "Fiş Analiz Ediliyor", subtitle: "Gizli maliyetler tespit ediliyor..." },
    en: { demo: "DEMO", title: "Analyzing Receipt", subtitle: "Detecting hidden costs..." }
  };

  const t = texts[locale as keyof typeof texts] || texts.en;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Badge variant="outline" className="text-primary border-primary/30 px-4 py-1">
          {t.demo}
        </Badge>
      </div>

      <Card className="card-cinematic">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">{t.title}</h2>
            <p className="text-muted-foreground text-sm">{t.subtitle}</p>
          </div>

          {/* Current Step */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-3">
              <motion.div 
                className="p-2 rounded-lg bg-primary/20 text-primary"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {currentStep.icon}
              </motion.div>
              <div className="flex-1">
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
              <div className="text-2xl font-bold text-primary tabular-nums">
                {Math.round(progress)}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {analysisSteps.slice(0, -1).map((step, idx) => {
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = idx === currentStepIndex;
              
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg text-xs transition-all",
                    isCompleted && "bg-primary/10 text-primary",
                    isCurrent && !isCompleted && "bg-muted text-foreground",
                    !isCompleted && !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.icon}
                  <span className="truncate">
                    {locale === "tr" ? step.labelTr.split(' ')[0] : step.labelEn.split(' ')[0]}
                  </span>
                  {isCompleted && <CheckCircle2 className="w-3 h-3 ml-auto text-primary" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
