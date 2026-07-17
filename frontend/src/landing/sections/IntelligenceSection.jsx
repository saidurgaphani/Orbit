import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { useScrollProgress } from '../hooks/useScrollProgress';

const MODULES = [
  { label: 'HEALTH INTELLIGENCE', desc: 'Sleep, activity, and wellness patterns' },
  { label: 'FINANCE INTELLIGENCE', desc: 'Spending, budgets, and financial health' },
  { label: 'DOCUMENT INTELLIGENCE', desc: 'OCR, storage, and document retrieval' },
  { label: 'DECISION INTELLIGENCE', desc: 'Structured reasoning for life choices' },
  { label: 'GOAL INTELLIGENCE', desc: 'Ambitions, habits, and progress tracking' },
  { label: 'SECURITY INTELLIGENCE', desc: 'Threat detection and scam analysis' },
];

export default function IntelligenceSection() {
  const { ref, progress } = useScrollProgress();

  return (
    <section id="intelligence" ref={ref} className="py-24 md:py-40 border-t border-charcoal">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="mb-16 md:mb-24">
          <SectionLabel>INTELLIGENCE SYSTEM</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            Six modules.
            <br />
            One understanding.
          </h2>
        </ScrollReveal>

        <div className="relative">


          {/* Module grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {MODULES.map((mod, i) => {
              const revealAt = (i + 1) / (MODULES.length + 1);
              const visible = progress > revealAt * 0.6;

              return (
                <div
                  key={mod.label}
                  className="border border-charcoal p-6 md:p-8 bg-alabaster transition-all duration-700 hover:border-forest hover:shadow-[2px_2px_0px_0px_rgba(55,85,52,1)]"
                  style={{
                    opacity: visible ? 1 : 0.2,
                    transform: visible ? 'translateY(0)' : 'translateY(20px)',
                    transitionDelay: `${i * 80}ms`,
                  }}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider text-forest">
                    {mod.label}
                  </span>
                  <p className="mt-3 text-sm text-charcoal/60 font-sans">{mod.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
