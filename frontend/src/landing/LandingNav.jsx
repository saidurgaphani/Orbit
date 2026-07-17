import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PrimaryButton } from '../components/ui/LandingButton';

const NAV_ITEMS = [
  { label: 'SYSTEM', href: '#system' },
  { label: 'INTELLIGENCE', href: '#intelligence' },
  { label: 'FEATURES', href: '#features' },
  { label: 'ABOUT', href: '#about' },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-alabaster/95 backdrop-blur-sm border-b border-charcoal shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="group shrink-0 flex items-center gap-3">
          <img src="/orbit.png" alt="Orbit Logo" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-black tracking-tight leading-none">
              Orbit
            </h1>
            <span className="text-[10px] md:text-xs uppercase tracking-widest font-semibold text-forest mt-0.5 block">
              Orbit
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-xs uppercase font-bold tracking-wider text-charcoal/70 hover:text-forest transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <PrimaryButton to="/app" className="hidden sm:inline-block !px-5 !py-2.5">
            Enter Orbit
          </PrimaryButton>

          <button
            type="button"
            className="lg:hidden border border-charcoal p-2 hover:bg-charcoal hover:text-alabaster transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor">
              {menuOpen ? (
                <path d="M1 1l16 12M17 1L1 13" stroke="currentColor" strokeWidth="1.5" fill="none" />
              ) : (
                <>
                  <rect y="0" width="18" height="1.5" />
                  <rect y="6" width="18" height="1.5" />
                  <rect y="12" width="18" height="1.5" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 top-[72px] bg-alabaster z-40 border-t border-charcoal">
          <nav className="flex flex-col p-8 gap-6">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="text-lg uppercase font-bold tracking-wider text-charcoal hover:text-forest transition-colors"
              >
                {item.label}
              </a>
            ))}
            <PrimaryButton to="/app" className="mt-4 text-center">
              Enter Orbit
            </PrimaryButton>
          </nav>
        </div>
      )}
    </header>
  );
}
