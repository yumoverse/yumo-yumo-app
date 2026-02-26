"use client"

import { Button } from "@/components/ui/button"
import { Menu, X, ExternalLink, Home } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { LanguageSelector } from "@/components/language-selector"

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  
  // Check if we're on the home page
  const isHomePage = pathname === "/"
  
  // Smart navigation helpers
  const getTokenomicsUrl = () => {
    return isHomePage 
      ? "#tokenomics" 
      : "https://yumo-yumo.gitbook.io/whitepaper/tokenomics"
  }
  
  const getRoadmapUrl = () => {
    return isHomePage 
      ? "#roadmap" 
      : "/#roadmap"
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10">
      <div className="w-full px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer">
          <motion.div whileHover={{ scale: 1.05 }}>
            <div
              className="yumo-lockup-topbar"
              style={{ fontSize: "17px" } as React.CSSProperties}
            >
              <span className="yumo-word yumo-word-gold">YUMO</span>
              <div className="yumo-sep" />
              <span className="yumo-word yumo-word-silver">YUMO</span>
            </div>
          </motion.div>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 backdrop-blur-sm flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <a
            href="https://yumo-yumo.gitbook.io/whitepaper/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 backdrop-blur-sm flex items-center gap-1.5"
          >
            Whitepaper
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href={getRoadmapUrl()}
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 backdrop-blur-sm"
          >
            Roadmap
          </a>
          <a
            href={getTokenomicsUrl()}
            {...(!isHomePage && { target: "_blank", rel: "noopener noreferrer" })}
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 backdrop-blur-sm flex items-center gap-1.5"
          >
            Tokenomics
            {!isHomePage && <ExternalLink className="w-3.5 h-3.5" />}
          </a>
          <a
            href="/faq"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 backdrop-blur-sm"
          >
            FAQ
          </a>
          <LanguageSelector />
          <Button
            onClick={() => window.location.href = 'https://app.yumoyumo.com'}
            className="ml-4 bg-primary hover:bg-primary/90 text-white"
          >
            Go App
          </Button>
        </div>

        <div className="flex md:hidden items-center gap-3">
          <LanguageSelector />
          <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              <Link
                href="/"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2 flex items-center gap-1.5"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home className="w-4 h-4" />
                Home
              </Link>
              <a
                href="https://yumo-yumo.gitbook.io/whitepaper/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2 flex items-center gap-1.5"
                onClick={() => setIsMenuOpen(false)}
              >
                Whitepaper
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={getRoadmapUrl()}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Roadmap
              </a>
              <a
                href={getTokenomicsUrl()}
                {...(!isHomePage && { target: "_blank", rel: "noopener noreferrer" })}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2 flex items-center gap-1.5"
                onClick={() => setIsMenuOpen(false)}
              >
                Tokenomics
                {!isHomePage && <ExternalLink className="w-3.5 h-3.5" />}
              </a>
              <a
                href="/faq"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                FAQ
              </a>
              <Button
                onClick={() => {
                  setIsMenuOpen(false);
                  window.location.href = 'https://app.yumoyumo.com';
                }}
                className="mt-2 bg-primary hover:bg-primary/90 text-white"
              >
                Go App
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
