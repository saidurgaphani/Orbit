import { PrimaryButton, SecondaryButton } from '../../components/ui/LandingButton';
import ScrollReveal from '../../components/ui/ScrollReveal';

export default function FinalCTASection() {
  return (
    <section className="py-32 md:py-48 border-t border-charcoal bg-alabaster">
      <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
        <ScrollReveal direction="up">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-black tracking-tight leading-tight">
            Your life is already full of signals.
          </h2>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={150}>
          <p className="mt-6 text-xl md:text-2xl font-serif text-charcoal/60">
            Let Orbit help you understand them.
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={300}>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryButton to="/app">Enter Orbit</PrimaryButton>
            <SecondaryButton href="#system">Explore the system</SecondaryButton>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="fade" delay={500}>
          <div className="mt-24 pt-8 border-t border-charcoal/10">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-charcoal/30">
              Orbit — Orbit
            </p>
            <p className="text-[10px] text-charcoal/20 mt-2 font-sans">
              Showcase content for demonstration purposes. Not connected to live user data.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
