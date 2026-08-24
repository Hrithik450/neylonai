import { Hero } from "@/components/landing-page/hero";
import { ProductShowcase } from "@/components/landing-page/product-showcase";
import { Features } from "@/components/landing-page/features";
import { HowItWorks } from "@/components/landing-page/how-it-works";
import { Comparison } from "@/components/landing-page/comparison";
import { Footer } from "@/components/landing-page/footer";
import type { Metadata } from "next";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Neylon AI - Turn Website Visitors into Qualified Leads",
  description:
    "Neylon AI's proactive assistant engages every visitor, qualifies their intent, and captures their contact — turning anonymous traffic into qualified leads for your team.",
  openGraph: {
    ...sharedOpenGraph,
    url: "/",
    title: "Neylon AI - Turn Anonymous Visitors into Qualified Leads",
    description:
      "Proactive AI suggestions that start the conversation, qualify each visitor, and capture their contact. Turn website traffic into leads.",
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
