"use client"

import React, { useState, useEffect } from "react";
import { HeroSection } from "@/components/hero-section";
import { HowItWorks } from "@/components/how-it-works";
import { RoadmapSection } from "@/components/roadmap-section";
import { TokenomicsSection } from "@/components/tokenomics-section";
import { PapersSection } from "@/components/papers-section";
import { WaitlistModal } from "@/components/waitlist-modal";

export default function LandingPage() {
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenAuth = (event: CustomEvent) => {
      if (event.detail?.mode === 'register') {
        setIsWaitlistModalOpen(true);
      }
    };

    window.addEventListener('openAuth', handleOpenAuth as EventListener);

    return () => {
      window.removeEventListener('openAuth', handleOpenAuth as EventListener);
    };
  }, []);

  return (
    <div>
      <HeroSection onSignUp={() => setIsWaitlistModalOpen(true)} />
      <HowItWorks />
      <RoadmapSection />
      <TokenomicsSection />
      <PapersSection />
      <WaitlistModal 
        isOpen={isWaitlistModalOpen} 
        onClose={() => setIsWaitlistModalOpen(false)} 
      />
    </div>
  );
}


