import { Customize } from "@/components/landing-page/customize-section";
import { Hero } from "@/components/landing-page/hero-section";
import { WhyChooseUs } from "@/components/landing-page/why-choose-section";
import { Navbar } from "@/components/navbar";

export default function App() {
  return (
    <main className="max-w-[120rem] mx-auto">
      <Navbar />
      <Hero />
      <WhyChooseUs />
      <Customize />
      {/* <Products /> */}
    </main>
  );
}
