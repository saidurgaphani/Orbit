import React from "react";
import { Home, Compass, Heart, FileText, Scale, Coins, ShieldAlert, Cog, Target, Menu, X } from "lucide-react";

export default function HeroDock({ activeTab, onNavigateToTab }) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const accent =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--hero-accent").trim()
      : "";

  const accentStyle = accent
    ? { "--accent": accent }
    : {};

  // If used inside navigation header, return responsive dock / hamburger menu
  if (onNavigateToTab) {
    const dockItems = [
      { icon: Home, label: "Home", tab: "home" },
      { icon: Compass, label: "Dashboard", tab: "dashboard" },
      { icon: Heart, label: "Health", tab: "health" },
      { icon: FileText, label: "Documents", tab: "docs" },
      { icon: Scale, label: "Decision", tab: "decision" },
      { icon: Coins, label: "Finance", tab: "finance" },
      { icon: Target, label: "Goals", tab: "goals" },
      { icon: ShieldAlert, label: "Scam Detector", tab: "scam" }
    ];

    return (
      <div style={accentStyle} className="relative origin-right flex items-center justify-end">
        {/* Desktop Dock: Hidden on mobile, shown on desktop */}
        <div className="hidden lg:block scale-90 sm:scale-95 origin-right">
          <Dock activeTab={activeTab} onNavigateToTab={onNavigateToTab} />
        </div>

        {/* Mobile Hamburger Trigger: Shown on mobile, hidden on desktop */}
        <div className="lg:hidden relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="border border-charcoal bg-alabaster p-2 text-charcoal shadow-[2px_2px_0px_0px_rgba(30,32,30,1)] rounded-full hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
            title="Menu"
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Mobile Dropdown Menu */}
          {menuOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40 bg-charcoal/20 backdrop-blur-[1px]" 
                onClick={() => setMenuOpen(false)}
              />
              {/* Dropdown Box */}
              <div className="absolute right-0 top-11 z-50 w-56 bg-alabaster border border-charcoal p-3 shadow-[4px_4px_0px_0px_rgba(30,32,30,1)] flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40 px-3 pb-1.5 border-b border-charcoal/10 mb-1">
                  Navigation
                </span>
                {dockItems.map(({ icon: Icon, label, tab }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      onNavigateToTab(tab);
                      setMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-1.5 border text-left transition-all uppercase text-[10px] font-bold tracking-wider hover:-translate-y-0.5 ${
                      activeTab === tab
                        ? 'bg-charcoal text-alabaster border-charcoal'
                        : 'border-transparent text-charcoal/60 hover:border-charcoal/30 hover:text-charcoal hover:bg-charcoal/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Otherwise return full landing page demo
  return (
    <div className="min-h-screen w-full relative bg-black" style={accentStyle}>
      {/* X Organizations Black Background with Top Glow */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(120, 180, 255, 0.25), transparent 70%), #000000",
        }}
      />

      {/* Main Section */}
      <section className="relative isolate min-h-screen w-full overflow-hidden text-white px-4 sm:px-8">
        {/* Vignette edges */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 [mask-image:radial-gradient(90%_70%_at_50%_45%,black,transparent_85%)] sm:[mask-image:radial-gradient(80%_60%_at_50%_40%,black,transparent_80%)]" />
          <div className="absolute inset-y-0 left-0 w-24 blur-xl opacity-40 sm:w-40 sm:blur-2xl sm:opacity-60 animate-marquee-left [background:linear-gradient(90deg,rgba(255,255,255,0.25),transparent)]" />
          <div className="absolute inset-y-0 right-0 w-24 blur-xl opacity-40 sm:w-40 sm:blur-2xl sm:opacity-60 animate-marquee-right [background:linear-gradient(270deg,rgba(255,255,255,0.25),transparent)]" />
        </div>

        {/* Subtle noise */}
        <div className="pointer-events-none absolute inset-0 -z-20 opacity-[0.05] [background-image:radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:12px_12px]" />

        <div
          className="mx-auto flex h-full max-w-5xl flex-col items-center justify-start gap-4 text-center sm:gap-8"
          style={{ marginTop: "20%" }}
        >
          <h1 className="text-balance font-semibold tracking-tight text-white/90 [font-size:clamp(20px,4.5vw,38px)]">
            Elegant, minimal dock
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-xs text-white/70 sm:text-sm">
            Black & white. Adaptive. Focused.
          </p>

          {/* Dock wrapper */}
          <div className="relative mt-6 w-full max-w-[85%] sm:max-w-[80%]">
            <div className="flex items-center justify-center">
              <Dock />
            </div>
          </div>
        </div>
      </section>

      {/* Styles */}
      <style>{`
        :root { --accent: hsl(0 0% 100% / 0.9); }
        .dark :root, .dark { --accent: hsl(0 0% 100% / 0.9); }
        .light :root, .light { --accent: hsl(0 0% 0% / 0.9); }

        @keyframes marqueeLeft { 0% { transform: translateX(-60%); } 100% { transform: translateX(0%); } }
        @keyframes marqueeRight { 0% { transform: translateX(60%); } 100% { transform: translateX(0%); } }
        .animate-marquee-left { animation: marqueeLeft 8s linear infinite alternate; }
        .animate-marquee-right { animation: marqueeRight 8s linear infinite alternate; }
      `}</style>
    </div>
  );
}

function Dock({ activeTab, onNavigateToTab }) {
  const navigate = onNavigateToTab || (() => {});

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-full bg-alabaster px-3 py-1.5 border border-charcoal shadow-[3px_3px_0px_0px_rgba(30,32,30,1)]">
        <DockIcon 
          icon={Home} 
          label="Home" 
          active={activeTab === 'home'} 
          onClick={() => navigate('home')} 
        />
        <DockIcon 
          icon={Compass} 
          label="Dashboard" 
          active={activeTab === 'dashboard'} 
          onClick={() => navigate('dashboard')} 
        />
        <DockIcon 
          icon={Heart} 
          label="Health" 
          active={activeTab === 'health'} 
          onClick={() => navigate('health')} 
        />
        <DockIcon 
          icon={FileText} 
          label="Documents" 
          active={activeTab === 'docs'} 
          onClick={() => navigate('docs')} 
        />
        <DockIcon 
          icon={Scale} 
          label="Decision" 
          active={activeTab === 'decision'} 
          onClick={() => navigate('decision')} 
        />
        <DockIcon 
          icon={Coins} 
          label="Finance" 
          active={activeTab === 'finance'} 
          onClick={() => navigate('finance')} 
        />
        <DockIcon 
          icon={Target} 
          label="Goals" 
          active={activeTab === 'goals'} 
          onClick={() => navigate('goals')} 
        />
        <DockIcon 
          icon={ShieldAlert} 
          label="Scam Detector" 
          active={activeTab === 'scam'} 
          onClick={() => navigate('scam')} 
        />
        <span className="mx-1 h-5 w-px bg-charcoal/20" aria-hidden="true" />
        <DockIcon 
          icon={Cog} 
          label="Settings" 
          active={activeTab === 'settings'} 
          onClick={() => navigate('scam')} 
        />
      </div>
    </div>
  );
}

function DockIcon({ icon: Icon, label, badge, active, onClick }) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`grid h-9 w-9 place-items-center rounded-full border transition-all duration-200 hover:-translate-y-0.5 ${
          active 
            ? 'bg-charcoal text-alabaster border-charcoal shadow-inner font-bold' 
            : 'bg-alabaster border-transparent text-charcoal/70 hover:bg-sage/35 hover:text-charcoal hover:border-charcoal/30'
        }`}
        aria-label={label}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
        {badge ? (
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-forest text-[9px] font-bold text-alabaster border border-alabaster">
            {badge}
          </span>
        ) : null}
      </button>
      <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-sans font-bold uppercase tracking-wider text-alabaster bg-charcoal border border-charcoal px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
