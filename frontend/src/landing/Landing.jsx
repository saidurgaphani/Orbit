import LandingNav from './LandingNav';
import HeroSection from './sections/HeroSection';
import ProblemSection from './sections/ProblemSection';
import CoreIdeaSection from './sections/CoreIdeaSection';
import DailyBriefSection from './sections/DailyBriefSection';
import LifeScoreSection from './sections/LifeScoreSection';
import IntelligenceSection from './sections/IntelligenceSection';
import CrossDomainSection from './sections/CrossDomainSection';
import MemorySection from './sections/MemorySection';
import CoreSystemsSection from './sections/CoreSystemsSection';
import FutureSection from './sections/FutureSection';
import FinalCTASection from './sections/FinalCTASection';
import './landing.css';

export default function Landing() {
  return (
    <div className="landing-page bg-alabaster text-charcoal font-sans antialiased">
      <LandingNav />
      <main>
        <HeroSection />
        <ProblemSection />
        <CoreIdeaSection />
        <DailyBriefSection />
        <LifeScoreSection />
        <IntelligenceSection />
        <CrossDomainSection />
        <MemorySection />
        <CoreSystemsSection />
        <FutureSection />
        <FinalCTASection />
      </main>
    </div>
  );
}
