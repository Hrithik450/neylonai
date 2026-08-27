import { Hero } from "@/components/landing-page/hero";
import { ProductShowcase } from "@/components/landing-page/product-showcase";
import { Features } from "@/components/landing-page/features";
import { HowItWorks } from "@/components/landing-page/how-it-works";
import { Comparison } from "@/components/landing-page/comparison";
import { Footer } from "@/components/landing-page/footer";
import type { Metadata } from "next";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Neylon AI - Automated Support & Lead Capture for SaaS",
  description:
    "Neylon AI answers customer questions directly from your docs, engages visitors proactively, and captures qualified leads — providing 24/7 support coverage without the headcount.",
  openGraph: {
    ...sharedOpenGraph,
    url: "/",
    title: "Neylon AI - Automated Support & Lead Capture",
    description:
      "The AI support team you don't have to hire. Neylon engages visitors, answers questions, and captures leads for your SaaS.",
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
