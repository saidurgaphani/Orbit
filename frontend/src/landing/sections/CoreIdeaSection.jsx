import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';

const CONTEXT_ITEMS = [
  { label: 'Poor sleep', type: 'signal' },
  { label: 'Upcoming interview', type: 'signal' },
  { label: 'Heavy schedule', type: 'signal' },
];

const RELATIONSHIPS = ['Health', 'Money', 'Time', 'Goals', 'Documents', 'Decisions'];

export default function CoreIdeaSection() {
  return (
    <section className="py-24 md:py-40 border-t border-charcoal bg-alabaster">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <ScrollReveal>
            <SectionLabel>CORE IDEA</SectionLabel>
            <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
              Not another app.
              <br />
              A layer above your life.
            </h2>
            <p className="mt-6 text-charcoal/70 font-sans leading-relaxed max-w-md">
              Orbit does not merely store data. Orbit connects context — understanding
              relationships between the different areas of your life.
            </p>
          </ScrollReveal>

          <div className="space-y-6">
            {/* Orbit layer */}
            <ScrollReveal direction="down" delay={100}>
              <div className="border-2 border-forest bg-forest/5 p-6 md:p-8 relative">
                <span className="text-xs uppercase font-bold tracking-widest text-forest">
                  Orbit — Intelligence Layer
                </span>
                <div className="mt-4 flex flex-wrap gap-2">
                  {RELATIONSHIPS.map((r) => (
                    <span
                      key={r}
                      className="text-[10px] uppercase font-semibold tracking-wider border border-forest/30 text-forest px-2 py-1"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Connector */}
            <ScrollReveal direction="fade" delay={300}>
              <div className="flex justify-center">
                <div className="w-px h-12 bg-charcoal/20 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-forest rounded-full" />
                </div>
              </div>
            </ScrollReveal>

            {/* Life data layer */}
            <ScrollReveal direction="up" delay={400}>
              <div className="border border-charcoal p-6 md:p-8 space-y-4">
                <span className="text-xs uppercase font-bold tracking-widest text-charcoal/50">
                  Your Life Data
                </span>
                <div className="space-y-3">
                  {CONTEXT_ITEMS.map((item, i) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 border border-charcoal/20 px-4 py-3"
                      style={{ transitionDelay: `${i * 100}ms` }}
                    >
                      <span className="w-1.5 h-1.5 bg-terracotta shrink-0" />
                      <span className="text-sm font-sans">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Insight result */}
            <ScrollReveal direction="up" delay={600}>
              <div className="border border-charcoal bg-charcoal text-alabaster p-6 md:p-8">
                <span className="text-[10px] uppercase font-bold tracking-widest text-sage">
                  ↓ Orbit understands the situation
                </span>
                <p className="mt-3 font-serif text-lg md:text-xl leading-relaxed">
                  Your sleep deficit may affect interview performance. Consider
                  rescheduling non-essential tasks today.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
