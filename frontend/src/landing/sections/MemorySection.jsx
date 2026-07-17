import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';

const EVENTS = [
  { date: '16 JUL 2026', event: 'Interview preparation', type: 'career' },
  { date: '14 JUL 2026', event: 'Insurance document uploaded', type: 'document' },
  { date: '10 JUL 2026', event: 'Started fitness goal', type: 'goal' },
  { date: '02 JUL 2026', event: 'Expense pattern detected', type: 'finance' },
  { date: '01 JUL 2026', event: 'Started learning React', type: 'learning' },
];

const TYPE_COLORS = {
  career: 'border-charcoal',
  document: 'border-charcoal/50',
  goal: 'border-forest',
  finance: 'border-terracotta/50',
  learning: 'border-charcoal/50',
};

export default function MemorySection() {
  return (
    <section className="py-24 md:py-40 border-t border-charcoal">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="mb-16 md:mb-24">
          <SectionLabel>MEMORY</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            EVA remembers what matters.
          </h2>
        </ScrollReveal>

        <div className="max-w-2xl">
          {EVENTS.map((item, i) => (
            <ScrollReveal key={item.date} direction="left" delay={i * 120}>
              <div className="flex gap-6 md:gap-8 py-4 border-b border-charcoal/10 last:border-b-0 group">
                <div className="shrink-0 w-28 md:w-32">
                  <span className="font-mono text-[10px] md:text-xs font-bold text-charcoal/40 uppercase">
                    {item.date}
                  </span>
                </div>
                <div
                  className={`flex-1 border-l-2 ${TYPE_COLORS[item.type]} pl-5 md:pl-6 py-1 transition-all duration-300 group-hover:border-l-4`}
                >
                  <p className="font-sans text-sm md:text-base">{item.event}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
