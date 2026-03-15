"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/i18n/context'
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState, useRef, useMemo } from 'react'

interface HeroSectionProps {
  onSignUp?: () => void
}

export function HeroSection({ onSignUp }: HeroSectionProps) {
  const { locale } = useLocale();
  const { data: session, status } = useSession()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll()
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95])
  
  const [isMounted, setIsMounted] = useState(false)
  
  // Mouse tracking for parallax effect - all hooks at top level
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springConfig = { damping: 25, stiffness: 150 }
  const mouseXSpring = useSpring(mouseX, springConfig)
  const mouseYSpring = useSpring(mouseY, springConfig)
  
  // Pre-compute all spring values at top level to avoid hooks in render
  const mouseXNegative = useTransform(mouseX, v => -v * 0.5)
  const mouseYNegative = useTransform(mouseY, v => -v * 0.5)
  const mouseXNegativeSpring = useSpring(mouseXNegative, springConfig)
  const mouseYNegativeSpring = useSpring(mouseYNegative, springConfig)
  

  useEffect(() => {
    setIsMounted(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e
      const { innerWidth, innerHeight } = window
      const x = (clientX - innerWidth / 2) / innerWidth
      const yPos = (clientY - innerHeight / 2) / innerHeight
      mouseX.set(x * 50)
      mouseY.set(yPos * 50)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  const heroContent: Record<string, any> = {
    en: {
      badge: "World's First Receipt-to-Earn Platform",
      title: "Decode your receipts.",
      subtitle: "Reveal hidden costs.",
      description: "",
      buttonGoApp: "Go App",
      buttonWaitlist: "Join the Waitlist",
      stats: {
        countries: "Countries",
        receipts: "Receipts Analyzed",
        hidden: "Hidden Cost Revealed"
      }
    },
    ru: {
      badge: "Первая в мире платформа Receipt-to-Earn",
      title: "Расшифруй свои чеки.",
      subtitle: "Раскрой скрытые затраты.",
      description: "",
      buttonGoApp: "В приложение",
      buttonWaitlist: "Присоединиться",
      stats: {
        countries: "Страны",
        receipts: "Чеков обработано",
        hidden: "Скрытых затрат найдено"
      }
    },
    tr: {
      badge: "Dünyanın İlk Fiş-Kazan Platformu",
      title: "Fişlerini deşifre et.",
      subtitle: "Gizli maliyetleri açığa çıkar.",
      description: "",
      buttonGoApp: "Uygulamaya Git",
      buttonWaitlist: "Bekleme Listesine Katıl",
      stats: {
        countries: "Ülke",
        receipts: "Fiş Analiz Edildi",
        hidden: "Gizli Maliyet Ortaya Çıktı"
      }
    },
    th: {
      badge: "แพลตฟอร์ม Receipt-to-Earn แห่งแรกของโลก",
      title: "ถอดรหัสใบเสร็จของคุณ",
      subtitle: "เปิดเผยต้นทุนที่ซ่อนอยู่",
      description: "",
      buttonGoApp: "ไปที่แอป",
      buttonWaitlist: "เข้าร่วมรายชื่อรอ",
      stats: {
        countries: "ประเทศ",
        receipts: "ใบเสร็จที่วิเคราะห์แล้ว",
        hidden: "ต้นทุนที่ซ่อนอยู่ถูกเปิดเผย"
      }
    },
    zh: {
      badge: "全球首个收据赚取平台",
      title: "解码你的收据。",
      subtitle: "揭示隐藏成本。",
      description: "",
      buttonGoApp: "进入应用",
      buttonWaitlist: "加入候补名单",
      stats: {
        countries: "国家",
        receipts: "已分析收据",
        hidden: "隐藏成本已揭示"
      }
    },
    es: {
      badge: "La Primera Plataforma Receipt-to-Earn del Mundo",
      title: "Decodifica tus recibos.",
      subtitle: "Revela los costos ocultos.",
      description: "",
      buttonGoApp: "Ir a la App",
      buttonWaitlist: "Únete a la Lista",
      stats: {
        countries: "Países",
        receipts: "Recibos Analizados",
        hidden: "Costos Ocultos Revelados"
      }
    }
  };

  const content = heroContent[locale] || heroContent.en;

  const handleButtonClick = () => {
    if (onSignUp) {
      onSignUp()
    } else {
      const event = new CustomEvent('openAuth', { detail: { mode: 'register' } })
      window.dispatchEvent(event)
    }
  }

  // Removed floating 3D cards for cleaner professional look

  // Pre-generate particle positions to avoid calling Math.random in render
  const particlePositions = useMemo(() => 
    Array.from({ length: 30 }, (_, i) => ({
      left: `${(i * 3.33) % 100}%`,
      top: `${(i * 7.77) % 100}%`,
      duration: 3 + (i % 5),
      delay: (i % 10) * 0.3,
      color: i % 3 === 0 ? '#ff7a1a' : i % 3 === 1 ? '#ec4899' : '#3b82f6',
    })),
  [])

  return (
    <section ref={containerRef} className="relative min-h-[115vh] flex items-center justify-center overflow-hidden pt-24 md:pt-0 pb-32">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0">
        {/* Base dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        
        {/* Animated aurora effect */}
        <motion.div 
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 122, 26, 0.3), transparent),
              radial-gradient(ellipse 60% 40% at 70% 80%, rgba(236, 72, 153, 0.2), transparent),
              radial-gradient(ellipse 50% 30% at 20% 60%, rgba(59, 130, 246, 0.2), transparent)
            `
          }}
          animate={{
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Floating orbs with mouse parallax */}
        {isMounted && (
          <>
            <motion.div
              className="absolute w-[600px] h-[600px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255, 122, 26, 0.15) 0%, transparent 70%)',
                left: '10%',
                top: '20%',
                x: mouseXSpring,
                y: mouseYSpring,
              }}
            />
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)',
                right: '10%',
                bottom: '10%',
                x: mouseXNegativeSpring,
                y: mouseYNegativeSpring,
              }}
            />
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
                left: '50%',
                top: '60%',
                transform: 'translateX(-50%)',
              }}
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </>
        )}
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px'
          }}
        />
        
        {/* Noise texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Subtle Geometric Patterns - Premium Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 border border-primary/30 rounded-lg rotate-12" />
        <div className="absolute top-40 right-20 w-24 h-24 border border-pink-500/30 rounded-full" />
        <div className="absolute bottom-40 left-1/4 w-40 h-40 border border-orange-500/20 rounded-lg -rotate-6" />
        <div className="absolute bottom-20 right-1/3 w-28 h-28 border border-cyan-500/20 rounded-full" />
      </div>

      {/* Particle system */}
      {isMounted && particlePositions.map((particle, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: particle.color,
            left: particle.left,
            top: particle.top,
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeOut"
          }}
        />
      ))}

      {/* Main content */}
      <motion.div
        style={{ opacity, scale }}
        className="container mx-auto px-4 relative z-10"
      >
        <div className="max-w-6xl mx-auto text-center space-y-10">
          
          {/* Main Title - Massive and impactful */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <motion.h1
              className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.85] text-center"
            >
              <motion.span
                className="block text-white text-center pb-4"
                style={{
                  textShadow: '0 0 80px rgba(255, 122, 26, 0.5)',
                }}
                animate={{
                  textShadow: [
                    '0 0 80px rgba(255, 122, 26, 0.3)',
                    '0 0 120px rgba(255, 122, 26, 0.6)',
                    '0 0 80px rgba(255, 122, 26, 0.3)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {content.title}
              </motion.span>
              <motion.span
                className="block mt-6 md:mt-8 text-center pb-6"
                style={{
                  background: 'linear-gradient(135deg, #ff7a1a 0%, #ec4899 50%, #ff7a1a 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 60px rgba(236, 72, 153, 0.5))',
                }}
                animate={{
                  backgroundPosition: ['0% center', '200% center'],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                {content.subtitle}
              </motion.span>
            </motion.h1>
            
            {/* Glow effects behind title */}
            <motion.div
              className="absolute inset-0 -z-10 blur-3xl opacity-30"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 122, 26, 0.4), rgba(236, 72, 153, 0.4))',
              }}
              animate={{
                opacity: [0.2, 0.4, 0.2],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>

          {/* Description - Only show if not empty */}
          {content.description && (
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl md:text-2xl lg:text-3xl text-gray-400 max-w-3xl mx-auto font-light leading-relaxed"
            >
              {content.description}
            </motion.p>
          )}

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 pt-8"
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleButtonClick}
                size="lg"
                className="group relative px-10 py-7 text-lg md:text-xl font-bold rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #ff7a1a 0%, #ec4899 100%)',
                  boxShadow: '0 20px 40px -10px rgba(255, 122, 26, 0.5)',
                }}
              >
                <span className="relative z-10 flex items-center gap-3">
                  {content.buttonWaitlist}
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="w-6 h-6" />
                  </motion.span>
                </span>
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                  animate={{ x: ['-200%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                />
              </Button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                size="lg"
                className="px-10 py-7 text-lg md:text-xl font-bold rounded-2xl border-2 border-white/20 bg-white/5 backdrop-blur-xl hover:bg-white/10 hover:border-white/40 text-white transition-all"
                onClick={() => { if (typeof window !== 'undefined') window.location.href = 'https://app.yumoyumo.com'; }}
              >
                {content.buttonGoApp}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
