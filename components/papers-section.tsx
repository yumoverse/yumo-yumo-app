"use client"

import Link from "next/link"
import { useTranslations } from "@/lib/i18n/hooks"
import { motion } from "framer-motion"

export function PapersSection() {
  const { t, locale } = useTranslations()
  const funPaperTagsRaw = t('papers.funPaper.tags')
  const seriousPaperTagsRaw = t('papers.seriousPaper.tags')
  const funPaperTags = Array.isArray(funPaperTagsRaw) ? funPaperTagsRaw : []
  const seriousPaperTags = Array.isArray(seriousPaperTagsRaw) ? seriousPaperTagsRaw : []

  // Get whitepaper URL based on current locale
  const getWhitepaperUrl = () => {
    const baseUrl = "https://yumo-yumo.gitbook.io/whitepaper"
    const localeMap: Record<string, string> = {
      'en': baseUrl,
      'ru': `${baseUrl}/documentation/ru-yumo-yumo-whitepaper`,
      'tr': `${baseUrl}/documentation/tr-yumo-yumo-whitepaper`,
      'th': `${baseUrl}/documentation/th-yumo-yumo-whitepaper`,
      'zh': `${baseUrl}/documentation/cn-yumo-yumo-whitepaper`,
      'es': `${baseUrl}/documentation/es-yumo-yumo-whitepaper`,
    }
    return localeMap[locale] || baseUrl
  }

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl lg:max-w-[80%] xl:max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-pink-500 to-orange-500 bg-clip-text text-transparent">
            {t('papers.title')}
          </h2>
          <p className="text-gray-400">{t('papers.subtitle')}</p>
        </motion.div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto lg:max-w-[80%] xl:max-w-4xl items-stretch">
        {/* Fun Paper - Magazine Cover Style */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex"
        >
          <Link
            href="/funpaper/"
            className="group block relative bg-white/5 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2 border border-white/10 flex flex-col w-full"
          >
          {/* Cover Image Area - Modern Professional Design */}
          <div className="relative h-[500px] bg-gradient-to-br from-primary/10 via-pink-500/10 to-orange-500/10 overflow-hidden border border-white/10">
            {/* Professional Grid Pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="funpaper-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#funpaper-grid)" className="text-primary" />
              </svg>
            </div>

            {/* Modern Geometric Shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-pink-500/20 to-transparent rounded-tr-full blur-3xl"></div>
            
            {/* Professional Accent Lines */}
            <div className="absolute top-20 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            <div className="absolute bottom-32 left-0 w-full h-px bg-gradient-to-r from-transparent via-pink-500/30 to-transparent"></div>

            {/* Magazine Header */}
            <div className="absolute top-0 left-0 right-0 p-6 z-10">
              <div className="flex justify-between items-start">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-xl shadow-lg">
                  <h3 className="text-primary text-xl font-bold tracking-wider">YUMO YUMO</h3>
                  <p className="text-gray-400 text-xs">Issue #001 • 2025</p>
                </div>
              </div>
            </div>

            {/* Center Professional Element */}
            <div className="absolute inset-0 flex items-center justify-center z-0">
              <div className="relative">
                {/* Modern Icon Container */}
                <div className="w-40 h-40 bg-gradient-to-br from-primary/30 via-pink-500/20 to-orange-500/20 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-2xl rotate-3">
                  <div className="w-32 h-32 bg-gradient-to-br from-primary/40 to-pink-500/30 rounded-2xl flex items-center justify-center -rotate-3">
                    <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>
                {/* Subtle Accent Elements */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary/40 rounded-full blur-sm"></div>
                <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-pink-500/40 rounded-full blur-sm"></div>
              </div>
            </div>

            {/* Cover Title */}
            <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
              <div className="bg-gradient-to-t from-black/70 via-black/40 to-transparent rounded-t-3xl p-6 backdrop-blur-sm">
                <h4 className="text-white text-5xl font-bold mb-3 leading-tight drop-shadow-lg text-left whitespace-pre-line break-words">{t('papers.funPaper.title')}</h4>
                <p className="text-white/95 text-xl mb-5 font-semibold drop-shadow-md text-left">{t('papers.funPaper.subtitle')}</p>
                <div className="flex flex-wrap gap-3">
                  {funPaperTags.map((tag, idx) => (
                    <span key={idx} className="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm border border-white/30">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Magazine Spine/Bottom Info */}
          <div className="p-4 pb-6 bg-white/5 backdrop-blur-sm border-t border-white/10 min-h-[120px] flex flex-col justify-center">
            <p className="text-gray-300 text-sm leading-normal whitespace-pre-line">
              {t('papers.funPaper.description')}
            </p>
          </div>
        </Link>
        </motion.div>

        {/* Serious Paper - Magazine Cover Style */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex"
        >
          <a
            href={getWhitepaperUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="group block relative bg-white/5 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2 border border-white/10 flex flex-col w-full"
          >
          {/* Cover Image Area - Professional Technical Design */}
          <div className="relative h-[500px] bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden border border-white/10">
            {/* Professional Technical Grid */}
            <div className="absolute inset-0 opacity-20">
              <svg className="w-full h-full" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="whitepaper-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white/30" />
                  </pattern>
                  <linearGradient id="tech-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
                    <stop offset="100%" stopColor="rgba(139, 92, 246, 0.3)" />
                  </linearGradient>
                </defs>
                <rect width="400" height="600" fill="url(#whitepaper-grid)" />
                {/* Concentric Circles */}
                <circle cx="200" cy="200" r="150" fill="none" stroke="url(#tech-gradient)" strokeWidth="1.5" opacity="0.4" />
                <circle cx="200" cy="200" r="100" fill="none" stroke="url(#tech-gradient)" strokeWidth="1.5" opacity="0.5" />
                <circle cx="200" cy="200" r="50" fill="none" stroke="url(#tech-gradient)" strokeWidth="1.5" opacity="0.6" />
                {/* Diagonal Lines */}
                <line x1="0" y1="0" x2="400" y2="600" stroke="url(#tech-gradient)" strokeWidth="1" opacity="0.2" />
                <line x1="400" y1="0" x2="0" y2="600" stroke="url(#tech-gradient)" strokeWidth="1" opacity="0.2" />
              </svg>
            </div>

            {/* Modern Gradient Overlays */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-bl-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-500/20 to-transparent rounded-tr-full blur-3xl"></div>

            {/* Magazine Header */}
            <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/40 to-transparent z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white text-2xl font-bold tracking-wider">YUMO YUMO</h3>
                  <p className="text-white/70 text-sm">Technical • 2025</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-3 py-1 rounded-full">
                  <span className="text-white font-bold text-sm">WHITEPAPER</span>
                </div>
              </div>
            </div>

            {/* Professional Center Element */}
            <div className="absolute inset-0 flex items-center justify-center z-0">
              <div className="relative">
                <div className="w-36 h-36 bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-2xl">
                  <svg className="w-20 h-20 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                {/* Subtle Tech Accents */}
                <div className="absolute -top-3 -right-3 w-4 h-4 bg-blue-400/60 rounded-full blur-sm"></div>
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-indigo-400/60 rounded-full blur-sm"></div>
              </div>
            </div>

            {/* Cover Title */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10">
              <h4 className="text-white text-4xl font-bold mb-2 leading-tight">{t('papers.seriousPaper.title')}</h4>
              <p className="text-white/90 text-lg mb-4">{t('papers.seriousPaper.subtitle')}</p>
              <div className="flex flex-wrap gap-2">
                {seriousPaperTags.map((tag, idx) => (
                  <span key={idx} className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Magazine Spine/Bottom Info */}
          <div className="p-6 bg-white/5 backdrop-blur-sm border-t border-white/10 min-h-[120px] flex flex-col justify-center">
            <p className="text-gray-300 text-sm leading-relaxed">
              {t('papers.seriousPaper.description')}
            </p>
          </div>
        </a>
        </motion.div>
      </div>
      </div>
    </section>
  )
}
