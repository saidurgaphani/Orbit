import { useState } from 'react';
import SectionLabel from '../../components/ui/SectionLabel';
import ScrollReveal from '../../components/ui/ScrollReveal';

const SYSTEMS = [
  {
    id: 'home',
    name: 'Home / Morning Brief',
    category: 'CORE',
    description: 'Your daily intelligence briefing — weather, priorities, life score, and AI recommendations assembled each morning.',
    preview: ['07:00 Brief ready', 'Life Score: 83', '3 priorities today'],
  },
  {
    id: 'health',
    name: 'Health Intelligence',
    category: 'PHYSIOLOGICAL',
    description: 'Centralized health dashboard combining biometrics, manual logs, medical reports, and AI coaching.',
    preview: ['Sleep: 6.2 hrs', 'Steps: 4,821', 'Hydration: 1.2L'],
  },
  {
    id: 'docs',
    name: 'Document Brain',
    category: 'COGNITION',
    description: 'Multimodal OCR and document intelligence. Upload, search, and understand your documents.',
    preview: ['12 documents indexed', 'Insurance policy parsed', 'Tax receipt stored'],
  },
  {
    id: 'decision',
    name: 'AI Decision Engine',
    category: 'LOGIC',
    description: 'Objective framework for dilemma resolution. Structured pros, cons, and weighted analysis.',
    preview: ['Decision: Job offer', '3 options analyzed', 'Confidence: 78%'],
  },
  {
    id: 'finance',
    name: 'Finance Brain',
    category: 'ECONOMIC',
    description: 'Ledger analysis and spending optimization. Track budgets, detect patterns, forecast trends.',
    preview: ['Monthly spend: ₹42,300', 'Budget: 87% used', '1 anomaly flagged'],
  },
  {
    id: 'goals',
    name: 'Goal & Habit Engine',
    category: 'STRATEGIC',
    description: 'Algorithmic breakdown of macro ambitions into micro tasks, milestones, and habit loops.',
    preview: ['3 active goals', 'React: 68% complete', 'Fitness: Day 12'],
  },
  {
    id: 'scam',
    name: 'Scam Detector',
    category: 'SECURITY',
    description: 'Threat analysis for suspicious communications. Paste any message for instant risk assessment.',
    preview: ['Last scan: Safe', '2 threats blocked', 'Shield: Active'],
  },
];

export default function CoreSystemsSection() {
  const [active, setActive] = useState(0);

  return (
    <section id="features" className="py-24 md:py-40 border-t border-charcoal bg-alabaster">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <ScrollReveal className="mb-16 md:mb-24">
          <SectionLabel>CORE SYSTEMS</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight mt-4 leading-tight">
            Seven systems.
            <br />
            One companion.
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* System selector */}
          <div className="lg:col-span-5 space-y-2">
            {SYSTEMS.map((sys, i) => (
              <ScrollReveal key={sys.id} direction="left" delay={i * 60}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={`w-full text-left border p-4 md:p-5 transition-all duration-300 ${
                    active === i
                      ? 'border-forest bg-forest/5 shadow-[2px_2px_0px_0px_rgba(55,85,52,1)]'
                      : 'border-charcoal/30 hover:border-charcoal'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/40">
                    {String(i + 1).padStart(2, '0')} — {sys.category}
                  </span>
                  <span className="block font-serif font-semibold text-base md:text-lg mt-1">
                    {sys.name}
                  </span>
                </button>
              </ScrollReveal>
            ))}
          </div>

          {/* Active system detail */}
          <div className="lg:col-span-7">
            <ScrollReveal direction="fade">
              <div className="border border-charcoal p-8 md:p-10 min-h-[400px] flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-forest">
                  {SYSTEMS[active].category}
                </span>
                <h3 className="text-2xl md:text-3xl font-serif font-black mt-2">
                  {SYSTEMS[active].name}
                </h3>
                <p className="mt-4 text-charcoal/70 font-sans leading-relaxed flex-1">
                  {SYSTEMS[active].description}
                </p>

                {/* Mini preview */}
                <div className="mt-8 border border-charcoal/20 p-5 space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-charcoal/40">
                    System Preview
                  </span>
                  {SYSTEMS[active].preview.map((line) => (
                    <div key={line} className="flex items-center gap-3">
                      <span className="w-1 h-1 bg-forest shrink-0" />
                      <span className="font-mono text-xs text-charcoal/60">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
