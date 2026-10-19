import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import BentoFeatures from "@/components/BentoFeatures";
import ComparisonSection from "@/components/ComparisonSection";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import Marquee from "@/components/landing/Marquee";
import { LandingMotion } from "@/components/landing/primitives";

export default function Home() {
  return (
    <LandingMotion>
      <div className="min-h-screen flex flex-col bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white">
        {/* 1. Header & Navigation */}
        <Navbar />

        <main className="flex-1">
          {/* 2. Hero con panel y teléfono animados */}
          <Hero />

          {/* 3. Cinta de funciones en movimiento */}
          <Marquee />

          {/* 4. Datos clave */}
          <StatsBar />

          {/* 6. Bento Grid Core Features */}
          <BentoFeatures />

          {/* 8. Comparison Table (Traditional vs FyDry Task) */}
          <ComparisonSection />

          {/* 9. Transparent Pricing Plans */}
          <Pricing />

          {/* 10. Frequently Asked Questions */}
          <FAQ />

          {/* 11. High-impact Final Call to Action */}
          <CTASection />
        </main>

        {/* 12. Footer */}
        <Footer />
      </div>
    </LandingMotion>
  );
}
