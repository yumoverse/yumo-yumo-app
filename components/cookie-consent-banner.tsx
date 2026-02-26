"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const COOKIE_CONSENT_KEY = "yumo-cookie-consent"

const translations = {
  en: {
    message: "We use cookies so that Yumbie can get to know you better and provide you with the best experience on our website. Do you agree?",
    accept: "Accept",
    decline: "Decline",
  },
  tr: {
    message: "Yumbie'nin seni daha iyi tanıması ve sana en iyi deneyimi sunmamız için çerezleri (cookies) kullanıyoruz. Kabul ediyor musun?",
    accept: "Kabul Et",
    decline: "Reddet",
  },
  "zh-TW": {
    message: "為了讓 Yumbie 更了解你並提供最佳體驗，我們使用 Cookie 來優化網站。你同意嗎？",
    accept: "同意",
    decline: "拒絕",
  },
  es: {
    message: "Utilizamos cookies para que Yumbie pueda conocerte mejor y ofrecerte la mejor experiencia en nuestra web. ¿Aceptas?",
    accept: "Aceptar",
    decline: "Rechazar",
  },
  ru: {
    message: "Мы используем файлы cookie, чтобы Юмби мог лучше узнать вас и обеспечить лучший сервис. Вы согласны?",
    accept: "Принять",
    decline: "Отклонить",
  },
  th: {
    message: "เราใช้คุกกี้เพื่อให้ Yumbie รู้จักคุณดีขึ้นและมอบประสบการณ์ที่ดีที่สุดให้กับคุณ คุณยอมรับไหม?",
    accept: "ยอมรับ",
    decline: "ปฏิเสธ",
  },
}

type SupportedLanguage = keyof typeof translations

function detectLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en"

  const browserLang = navigator.language || (navigator as any).userLanguage

  // Check for exact match first
  if (translations[browserLang as SupportedLanguage]) {
    return browserLang as SupportedLanguage
  }

  // Check for language code match (e.g., "zh-CN" -> "zh-TW")
  const langCode = browserLang.split("-")[0]
  if (langCode === "zh") {
    return "zh-TW"
  }
  if (langCode === "tr") {
    return "tr"
  }
  if (langCode === "es") {
    return "es"
  }
  if (langCode === "ru") {
    return "ru"
  }
  if (langCode === "th") {
    return "th"
  }

  return "en"
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [language, setLanguage] = useState<SupportedLanguage>("en")

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Detect language and show banner
      const detectedLang = detectLanguage()
      setLanguage(detectedLang)
      setIsVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted")
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined")
    setIsVisible(false)
  }

  const t = translations[language]

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-50"
        >
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="relative rounded-2xl bg-card border border-border shadow-2xl p-4 sm:p-6 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
              <button
                onClick={handleDecline}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <div className="pr-8 sm:pr-12">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <p className="text-sm sm:text-base text-foreground leading-relaxed flex-1">
                    {t.message}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
                    <Button
                      onClick={handleAccept}
                      variant="default"
                      size="default"
                      className="w-full sm:w-auto min-w-[120px]"
                    >
                      {t.accept}
                    </Button>
                    <Button
                      onClick={handleDecline}
                      variant="outline"
                      size="default"
                      className="w-full sm:w-auto min-w-[120px]"
                    >
                      {t.decline}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}































