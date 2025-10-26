// import { LatestBlogs } from "@/components/landing-page/blog-section";
import { CTASection } from "@/components/landing-page/cta-section";
import { FeatureSection } from "@/components/landing-page/features";
import { Footer } from "@/components/landing-page/footer-section";
import { Hero2 } from "@/components/landing-page/hero-2-section";
import { Faq } from "@/components/landing-page/faq-section";
import React from "react";

export default function App() {
  return (
    <div className="relative max-w-480 mx-auto">
      <Hero2 />
      <FeatureSection />
      {/* <LatestBlogs /> */}
      <Faq />
      <CTASection />
      <Footer />
      {/* <Testimonials /> */}
    </div>
  );
}
