import { Hero } from "@/components/landing-page/hero";
import { ProductShowcase } from "@/components/landing-page/product-showcase";
import { Features } from "@/components/landing-page/features";
import { HowItWorks } from "@/components/landing-page/how-it-works";
import { Comparison } from "@/components/landing-page/comparison";
import { Footer } from "@/components/landing-page/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neylon AI - AI-Powered Customer Engagement & Real-Time Visitor Insights",
  description:
    "Know why visitors leave. Engage them sooner. Neylon AI watches visitors in real time, starts conversations at the right moment, and turns traffic into engagement.",
  openGraph: {
    title: "Neylon AI - Know Why Visitors Leave. Engage Them Sooner.",
    description:
      "Real-time visitor tracking and proactive AI conversations that convert. Transform website traffic into meaningful customer engagement.",
  },
};

export default function App() {
  return (
    <div className="relative space-y-2">
      <div className="mb-4 sm:mb-8 lg:mb-14">
        <Hero />
      </div>
      <ProductShowcase />
      <Features />
      <HowItWorks />
      <Comparison />
      <Footer />
    </div>
  );
}
