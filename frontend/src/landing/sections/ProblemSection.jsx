import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { useScrollProgress } from '../hooks/useScrollProgress';

const FRAGMENTS = [
  { label: 'Health App', x: -120, y: -80, rotate: -3 },
  { label: 'Bank App', x: 100, y: -60, rotate: 2 },
  { label: 'Calendar', x: -80, y: 20, rotate: -1 },
  { label: 'Documents', x: 130, y: 40, rotate: 3 },
  { label: 'Notes', x: -140, y: 100, rotate: -2 },
  { label: 'Email', x: 60, y: 110, rotate: 1 },
  { label: 'Messages', x: -30, y: -120, rotate: 2 },
  { label: 'Career Platforms', x: 150, y: -20, rotate: -2 },
];

export default function ProblemSection() {
  const { ref, progress } = useScrollProgress();
  const spread = Math.min(1, progress * 2);
  const connected = progress > 0.55;

  return (
    <section id="system" ref={ref} className="py-24 md:py-40 border-t border-charcoal">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="max-w-3xl mb-16 md:mb-24">
          <SectionLabel>THE PROBLEM</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            Your life is connected.
            <br />
            Your apps are not.
          </h2>
        </ScrollReveal>

        <div className="relative h-[420px] md:h-[500px] border border-charcoal bg-alabaster overflow-hidden">
          {/* Fragment cards */}
          {FRAGMENTS.map((f, i) => {
            const offsetX = f.x * spread;
            const offsetY = f.y * spread;
            const opacity = connected ? 0.3 : 0.7 + spread * 0.3;

            return (
              <div
                key={f.label}
                className="absolute top-1/2 left-1/2 transition-all duration-700 ease-out"
                style={{
                  transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${f.rotate * spread}deg)`,
                  opacity,
                  transitionDelay: `${i * 30}ms`,
                }}
              >
                <div className="border border-charcoal bg-alabaster px-4 py-3 md:px-5 md:py-4 shadow-[2px_2px_0px_0px_rgba(30,32,30,1)] whitespace-nowrap">
                  <span className="text-[10px] md:text-xs uppercase font-bold tracking-wider text-charcoal/60">
                    {f.label}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Connection lines when transitioning */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000"
            style={{ opacity: connected ? 1 : 0 }}
          >
            <line x1="50%" y1="50%" x2="30%" y2="35%" stroke="#375534" strokeWidth="1" opacity="0.3" className={connected ? 'line-draw' : ''} />
            <line x1="50%" y1="50%" x2="70%" y2="40%" stroke="#375534" strokeWidth="1" opacity="0.3" />
            <line x1="50%" y1="50%" x2="35%" y2="65%" stroke="#375534" strokeWidth="1" opacity="0.3" />
            <line x1="50%" y1="50%" x2="65%" y2="60%" stroke="#375534" strokeWidth="1" opacity="0.3" />
            <circle cx="50%" cy="50%" r="24" fill="none" stroke="#375534" strokeWidth="1" opacity="0.2" />
          </svg>

          {/* Central EVA when connected */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
            style={{
              opacity: connected ? 1 : 0,
              transform: `translate(-50%, -50%) scale(${connected ? 1 : 0.8})`,
            }}
          >
            <div className="border-2 border-forest bg-alabaster px-6 py-4 text-center">
              <span className="text-lg font-serif font-black">EVA</span>
            </div>
          </div>
        </div>

        <ScrollReveal className="mt-16 md:mt-24 text-center" delay={200}>
          <p className="text-2xl md:text-4xl font-serif font-semibold text-forest">
            EVA brings the context together.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
