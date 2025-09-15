import { AIChat } from "@/components/ai-chat";
import { LatestBlogs } from "@/components/landing-page/blog-section";
import { CTASection } from "@/components/landing-page/cta-section";
import { Faq } from "@/components/landing-page/faq-section";
import { FeatureSection } from "@/components/landing-page/features";
import { Footer } from "@/components/landing-page/footer-section";
import { Hero2 } from "@/components/landing-page/hero-2-section";
import { Hero } from "@/components/landing-page/hero-section";
import { Testimonials } from "@/components/landing-page/testimonial";
import { WhyChooseUs } from "@/components/landing-page/why-choose-section";
import { Navbar } from "@/components/navbar";

export default function App() {
  return (
    <main className="max-w-[120rem] mx-auto">
      {/* <Navbar />
      <Hero />
      <WhyChooseUs /> */}
      <AIChat />
      <Hero2 />
      <FeatureSection />
      <Faq />
      <Testimonials />
      <LatestBlogs />
      <CTASection />
      <Footer />
      {/* <Customize /> */}
      {/* <Products /> */}
    </main>
  );
}
