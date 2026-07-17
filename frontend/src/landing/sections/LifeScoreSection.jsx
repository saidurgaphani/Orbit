import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useCountUp } from '../hooks/useCountUp';

const DIMENSIONS = [
  { label: 'HEALTH', value: 78, status: 'Stable' },
  { label: 'FINANCE', value: 85, status: 'On track' },
  { label: 'GOALS', value: 72, status: 'Needs attention' },
  { label: 'LEARNING', value: 68, status: 'Behind pace' },
  { label: 'SECURITY', value: 91, status: 'Protected' },
];

export default function LifeScoreSection() {
  const { ref, visible } = useScrollReveal({ threshold: 0.3 });
  const score = useCountUp(83, visible);

  return (
    <section ref={ref} className="py-24 md:py-40 border-t border-charcoal bg-alabaster">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="mb-16 md:mb-24">
          <SectionLabel>LIFE SCORE</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            One view of how your life is moving.
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Score display */}
          <ScrollReveal direction="scale" className="lg:col-span-5">
            <div className="border border-charcoal p-8 md:p-12 text-center">
              <span className="text-xs uppercase font-bold tracking-widest text-charcoal/50">
                Life Score
              </span>
              <div className="mt-4 flex items-baseline justify-center gap-2">
                <span className="text-7xl md:text-8xl font-serif font-black tabular-nums">
                  {score}
                </span>
                <span className="text-2xl font-serif text-charcoal/30">/ 100</span>
              </div>
              <div className="mt-6 h-1 bg-charcoal/10 relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-forest transition-all duration-[1800ms] ease-out"
                  style={{ width: visible ? `${score}%` : '0%' }}
                />
              </div>
            </div>
          </ScrollReveal>

          {/* Dimensions */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
            {DIMENSIONS.map((dim, i) => (
              <ScrollReveal key={dim.label} direction="up" delay={200 + i * 100}>
                <div className="border border-charcoal p-4 md:p-5 text-center hover:border-forest transition-colors duration-300">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block">
                    {dim.label}
                  </span>
                  <span className="text-2xl md:text-3xl font-serif font-black mt-2 block tabular-nums">
                    {dim.value}
                  </span>
                  <span className="text-[10px] text-charcoal/40 mt-1 block">{dim.status}</span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal className="mt-16 md:mt-24 max-w-2xl" delay={400}>
          <p className="text-charcoal/60 font-sans leading-relaxed">
            Orbit looks at patterns across your life to help you understand what needs attention.
            Not a gamification gimmick — a summary of life context.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
