import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';

const SIGNALS = [
  { label: 'SLEEP', direction: 'down', value: '↓' },
  { label: 'WORKLOAD', direction: 'up', value: '↑' },
  { label: 'SPENDING', direction: 'up', value: '↑' },
  { label: 'GOAL PROGRESS', direction: 'down', value: '↓' },
];

export default function CrossDomainSection() {
  return (
    <section className="py-24 md:py-40 border-t border-charcoal bg-alabaster">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="mb-16 md:mb-24">
          <SectionLabel>CROSS-DOMAIN INTELLIGENCE</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            EVA notices relationships.
          </h2>
          <p className="mt-4 text-charcoal/60 font-sans max-w-lg">
            EVA does not only answer questions. EVA connects signals across different areas of your life.
          </p>
        </ScrollReveal>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Signal cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {SIGNALS.map((s, i) => (
              <ScrollReveal key={s.label} direction="up" delay={i * 100}>
                <div className="border border-charcoal p-4 md:p-5 text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block">
                    {s.label}
                  </span>
                  <span
                    className={`text-2xl md:text-3xl font-serif font-black mt-2 block ${
                      s.direction === 'down' ? 'text-terracotta' : 'text-forest'
                    }`}
                  >
                    {s.value}
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Connector */}
          <ScrollReveal direction="fade" delay={500}>
            <div className="flex justify-center py-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-px h-8 bg-charcoal/20" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-forest">
                  EVA Insight
                </span>
                <div className="w-px h-8 bg-charcoal/20" />
              </div>
            </div>
          </ScrollReveal>

          {/* Insight */}
          <ScrollReveal direction="up" delay={600}>
            <div className="border-2 border-forest bg-forest/5 p-8 md:p-10">
              <p className="font-serif text-xl md:text-2xl leading-relaxed text-charcoal">
                &ldquo;Your recent schedule may be affecting both your energy and your consistency.&rdquo;
              </p>
              <span className="mt-4 text-[10px] uppercase font-bold tracking-widest text-forest/60 block">
                Cross-domain pattern detected
              </span>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
