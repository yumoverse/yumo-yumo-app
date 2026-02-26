"use client"

import { Card } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/hooks"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"

const percentages = [70, 15, 10, 5]
const colors = ["#ff7a1a", "#3b82f6", "#ec4899", "#f59e0b"]
const gradients = [
  { start: "#ff7a1a", end: "#ff9a4a" },
  { start: "#3b82f6", end: "#60a5fa" },
  { start: "#ec4899", end: "#f472b6" },
  { start: "#f59e0b", end: "#fbbf24" },
]

// Custom animated ring chart component
function TokenRingChart({ distribution, activeIndex, setActiveIndex }: { 
  distribution: Array<{ label: string; percentage: number; color: string }>;
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
}) {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300)
    return () => clearTimeout(timer)
  }, [])

  const size = 500
  const strokeWidth = 40
  const radius = 140
  const center = size / 2

  // Calculate segments
  let currentAngle = -90 // Start from top
  const segments = distribution.map((item, index) => {
    const angle = (item.percentage / 100) * 360
    const startAngle = currentAngle
    currentAngle += angle
    return {
      ...item,
      startAngle,
      endAngle: currentAngle,
      index,
    }
  })

  // Convert angle to coordinates
  const polarToCartesian = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    }
  }

  // Create arc path
  const createArc = (startAngle: number, endAngle: number, innerRadius: number, outerRadius: number) => {
    const start = polarToCartesian(startAngle, outerRadius)
    const end = polarToCartesian(endAngle, outerRadius)
    const innerStart = polarToCartesian(endAngle, innerRadius)
    const innerEnd = polarToCartesian(startAngle, innerRadius)
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

    return `
      M ${start.x} ${start.y}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}
      L ${innerStart.x} ${innerStart.y}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}
      Z
    `
  }

  return (
    <div className="relative">
      {/* Glow effect behind */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
      </div>
      
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative z-10">
        <defs>
          {/* Gradients for each segment */}
          {gradients.map((grad, i) => (
            <linearGradient key={`grad-${i}`} id={`segment-gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={grad.start} />
              <stop offset="100%" stopColor={grad.end} />
            </linearGradient>
          ))}
          
          {/* Glow filters */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth + 8}
        />

        {/* Animated segments */}
        {segments.map((segment, index) => {
          const isActive = activeIndex === index
          const innerR = radius - strokeWidth / 2
          const outerR = radius + strokeWidth / 2
          const activeOuterR = outerR + (isActive ? 8 : 0)
          
          return (
            <motion.path
              key={`segment-${index}`}
              d={createArc(segment.startAngle, segment.endAngle - 1, innerR, activeOuterR)}
              fill={`url(#segment-gradient-${index})`}
              filter={isActive ? "url(#glow-strong)" : "url(#glow)"}
              initial={{ 
                opacity: 0, 
                scale: 0.8,
              }}
              animate={{ 
                opacity: isVisible ? 1 : 0,
                scale: isVisible ? 1 : 0.8,
              }}
              transition={{ 
                duration: 0.8, 
                delay: index * 0.15,
                ease: "easeOut"
              }}
              style={{
                transformOrigin: `${center}px ${center}px`,
                cursor: 'pointer',
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              whileHover={{ scale: 1.02 }}
            />
          )
        })}

        {/* Inner decorative ring */}
        <circle
          cx={center}
          cy={center}
          r={radius - strokeWidth - 8}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Center content */}
        <motion.g
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.5 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {/* Inner circle background */}
          <circle
            cx={center}
            cy={center}
            r={radius - strokeWidth - 20}
            fill="rgba(10, 13, 20, 0.8)"
          />
          
          {/* Center text */}
          <text
            x={center}
            y={center - 25}
            textAnchor="middle"
            fill="white"
            fontSize="14"
            fontWeight="500"
          >
            Total Supply
          </text>
          <text
            x={center}
            y={center + 10}
            textAnchor="middle"
            fill="#ff7a1a"
            fontSize="32"
            fontWeight="bold"
          >
            99B
          </text>
          <text
            x={center}
            y={center + 35}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="12"
          >
            $YUMO
          </text>
        </motion.g>

        {/* Percentage labels on segments - Premium Badge Style */}
        {segments.map((segment, index) => {
          const midAngle = (segment.startAngle + segment.endAngle) / 2
          const labelRadius = radius + strokeWidth + 35
          const pos = polarToCartesian(midAngle, labelRadius)
          
          return (
            <motion.g
              key={`label-${index}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.5 }}
              transition={{ delay: 0.8 + index * 0.1, type: "spring", stiffness: 200 }}
            >
              {/* Premium badge background with gradient */}
              <defs>
                <linearGradient id={`badge-gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={gradients[index].start} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={gradients[index].end} stopOpacity="0.3" />
                </linearGradient>
                <filter id={`badge-glow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Badge background circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r="28"
                fill={`url(#badge-gradient-${index})`}
                stroke={gradients[index].start}
                strokeWidth="2"
                opacity="0.9"
                filter={`url(#badge-glow-${index})`}
              />
              
              {/* Percentage text with segment color */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={gradients[index].start}
                fontSize="18"
                fontWeight="900"
                style={{ 
                  filter: `drop-shadow(0 0 4px ${gradients[index].start}80)`,
                  letterSpacing: "-0.5px"
                }}
              >
                {segment.percentage}%
              </text>
            </motion.g>
          )
        })}
      </svg>
    </div>
  )
}

export function TokenomicsSection() {
  const { t, locale } = useTranslations()
  const distributionData = t('tokenomics.distribution') as Array<{ label: string; description: string }>
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Get tokenomics URL based on current locale
  const getTokenomicsUrl = () => {
    const baseUrl = "https://yumo-yumo.gitbook.io/whitepaper"
    const localeMap: Record<string, string> = {
      'en': `${baseUrl}/tokenomics`,
      'ru': `${baseUrl}/documentation/ru-yumo-yumo-whitepaper/tokenomics`,
      'tr': `${baseUrl}/documentation/tr-yumo-yumo-whitepaper/tokenomics`,
      'th': `${baseUrl}/documentation/th-yumo-yumo-whitepaper/tokenomics`,
      'zh': `${baseUrl}/documentation/cn-yumo-yumo-whitepaper/tokenomics`,
      'es': `${baseUrl}/documentation/es-yumo-yumo-whitepaper/tokenomics`,
    }
    return localeMap[locale] || `${baseUrl}/tokenomics`
  }

  const distribution = Array.isArray(distributionData) ? distributionData.map((item, index) => ({
    ...item,
    percentage: percentages[index],
    color: colors[index],
  })) : []

  return (
    <section id="tokenomics" className="py-20 px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto max-w-6xl lg:max-w-[80%] xl:max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-sm text-gray-400 mb-4"
          >
            💎 Tokenomics
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            {t('tokenomics.title')}
          </h2>
          <p className="text-xl font-semibold bg-gradient-to-r from-primary via-pink-500 to-orange-500 bg-clip-text text-transparent">
            {t('tokenomics.subtitle')}
          </p>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto">
            {t('tokenomics.totalSupply')}
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto lg:max-w-[80%] xl:max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Custom Ring Chart */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex items-center justify-center py-4"
            >
              <TokenRingChart 
                distribution={distribution} 
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
              />
            </motion.div>

            {/* Distribution Cards */}
            <div className="space-y-4">
              {distribution.map((item, index) => {
                const isActive = activeIndex === index
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    <Card 
                      className={`p-5 border transition-all duration-300 cursor-pointer ${
                        isActive 
                          ? 'border-primary/50 bg-white/10 scale-[1.02] shadow-lg shadow-primary/20' 
                          : 'border-white/10 bg-white/5 backdrop-blur-xl hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Animated indicator */}
                        <div className="relative">
                          <motion.div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ 
                              background: `linear-gradient(135deg, ${gradients[index].start}, ${gradients[index].end})`,
                            }}
                            animate={{
                              boxShadow: isActive 
                                ? `0 0 20px ${item.color}60` 
                                : `0 0 0px ${item.color}00`
                            }}
                          >
                            <span className="text-white font-bold text-lg">{item.percentage}%</span>
                          </motion.div>
                          {isActive && (
                            <motion.div
                              className="absolute -inset-1 rounded-xl"
                              style={{ 
                                background: `linear-gradient(135deg, ${gradients[index].start}40, ${gradients[index].end}40)`,
                              }}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              layoutId="active-glow"
                            />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-white truncate pr-2">{item.label}</span>
                          </div>
                          <p className="text-sm text-gray-400 mb-3 line-clamp-2">{item.description}</p>
                          
                          {/* Progress bar */}
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${item.percentage}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, delay: index * 0.15, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ 
                                background: `linear-gradient(90deg, ${gradients[index].start}, ${gradients[index].end})`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* CTA Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12"
          >
            <a 
              href={getTokenomicsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="p-6 border border-primary/30 bg-gradient-to-r from-primary/10 via-pink-500/10 to-orange-500/10 backdrop-blur-xl hover:border-primary/50 transition-all cursor-pointer group">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl">📊</span>
                  <p className="text-sm text-center font-medium">
                    <span className="text-gray-300 group-hover:text-white transition-colors">
                      {t('tokenomics.detailedLink')}
                    </span>
                  </p>
                  <motion.span 
                    className="text-primary"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </div>
              </Card>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
