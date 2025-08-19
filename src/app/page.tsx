import { CTASection } from "@/components/landing-page/cta-section";
import { FeatureSection } from "@/components/landing-page/features";
import { Footer } from "@/components/landing-page/footer-section";
import { Hero } from "@/components/landing-page/hero";
import { Faq } from "@/components/landing-page/faq-section";
import React from "react";

export default function App() {
  return (
    <div className="relative max-w-480 mx-auto">
      <Hero />
      <FeatureSection />
      <Faq />
      <CTASection />
      <Footer />
    </div>
  );
}
