import { AIChat } from "@/components/support-widget/widget-toggle";
import { LatestBlogs } from "@/components/landing-page/blog-section";
import { CTASection } from "@/components/landing-page/cta-section";
import { Faq } from "@/components/landing-page/faq-section";
import { FeatureSection } from "@/components/landing-page/features";
import { Footer } from "@/components/landing-page/footer-section";
import { Hero2 } from "@/components/landing-page/hero-2-section";
import { Testimonials } from "@/components/landing-page/testimonial";
import { Navbar } from "@/components/navbar";
import { auth } from "@/lib/auth/auth";
import React from "react";

export default function App() {
  const session = React.use(auth());

  return (
    <main className="relative max-w-[120rem] mx-auto">
      {/* <Navbar /> */}
      {/* <Hero /> */}
      {/* <WhyChooseUs /> */}
      <Navbar session={session} />
      <Hero2 session={session} />
      <FeatureSection />
      <Faq />
      <Testimonials />
      <LatestBlogs />
      <CTASection />
      <Footer />
      {/* <Customize /> */}
      {/* <Products /> */}

      {/* Support widget */}
      <AIChat session={session} />
    </main>
  );
}
