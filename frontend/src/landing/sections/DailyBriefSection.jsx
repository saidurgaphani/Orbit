import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';

const BRIEF_ITEMS = [
  { time: '07:00', text: 'Good morning.', type: 'neutral' },
  { time: '08:15', text: 'You slept less than usual.', type: 'alert' },
  { time: '10:00', text: 'Interview today.', type: 'priority' },
  { time: '12:30', text: 'Spending is above your weekly average.', type: 'alert' },
  { time: '16:00', text: 'Rain expected.', type: 'neutral' },
  { time: '18:00', text: 'Your study goal is falling behind.', type: 'alert' },
];

const TYPE_STYLES = {
  neutral: 'border-charcoal/30',
  alert: 'border-terracotta/40',
  priority: 'border-forest',
};

export default function DailyBriefSection() {
  return (
    <section className="py-24 md:py-40 border-t border-charcoal">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="mb-16 md:mb-24">
          <SectionLabel>DAILY BRIEF</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            Your day, continuously understood.
          </h2>
        </ScrollReveal>

        <div className="max-w-2xl mx-auto relative">
          {/* Timeline line */}
          <div className="absolute left-[27px] md:left-[31px] top-0 bottom-0 w-px bg-charcoal/15" />

          <div className="space-y-0">
            {BRIEF_ITEMS.map((item, i) => (
              <ScrollReveal key={item.time} direction="left" delay={i * 120}>
                <div className="flex gap-6 md:gap-8 py-5 md:py-6 group">
                  <div className="shrink-0 w-14 md:w-16 text-right">
                    <span className="font-mono text-xs md:text-sm font-bold text-charcoal/50">
                      {item.time}
                    </span>
                  </div>

                  <div className="relative shrink-0">
                    <div
                      className={`w-3 h-3 border-2 bg-alabaster relative z-10 transition-colors duration-300 group-hover:bg-forest group-hover:border-forest ${
                        item.type === 'priority' ? 'border-forest bg-forest/20' : 'border-charcoal'
                      }`}
                    />
                  </div>

                  <div
                    className={`flex-1 border-l-0 border ${TYPE_STYLES[item.type]} px-5 py-4 bg-alabaster transition-all duration-300 group-hover:shadow-[2px_2px_0px_0px_rgba(30,32,30,1)] group-hover:-translate-y-0.5`}
                  >
                    <p className="font-sans text-sm md:text-base">{item.text}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
