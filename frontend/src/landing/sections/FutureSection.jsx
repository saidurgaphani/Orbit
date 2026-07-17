import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';

const TIMELINE = [
  {
    phase: 'TODAY',
    title: 'Understand your life.',
    description: 'EVA connects your health, finances, goals, and documents into one coherent view.',
  },
  {
    phase: 'NEXT',
    title: 'Predict what needs attention.',
    description: 'Pattern recognition across domains surfaces issues before they become problems.',
  },
  {
    phase: 'LATER',
    title: 'Help you act before problems happen.',
    description: 'Proactive recommendations based on your unique life patterns — with your permission.',
  },
];

export default function FutureSection() {
  return (
    <section id="about" className="py-24 md:py-40 border-t border-charcoal">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="mb-16 md:mb-24">
          <SectionLabel>THE FUTURE</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            One companion.
            <br />
            Every part of life.
          </h2>
        </ScrollReveal>

        <div className="relative max-w-3xl mx-auto">
          {/* Timeline line */}
          <div className="absolute left-0 md:left-8 top-0 bottom-0 w-px bg-charcoal/15 hidden md:block" />

          <div className="space-y-12 md:space-y-16">
            {TIMELINE.map((item, i) => (
              <ScrollReveal key={item.phase} direction="up" delay={i * 200}>
                <div className="md:pl-20 relative">
                  <div className="hidden md:block absolute left-6 top-2 w-4 h-4 border-2 border-forest bg-alabaster" />

                  <span className="text-xs uppercase font-bold tracking-[0.2em] text-forest">
                    {item.phase}
                  </span>
                  <h3 className="text-xl md:text-2xl font-serif font-semibold mt-2">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-charcoal/60 font-sans leading-relaxed max-w-lg">
                    {item.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
