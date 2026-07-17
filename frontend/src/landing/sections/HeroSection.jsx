import React from 'react';
import { PrimaryButton, SecondaryButton } from '../../components/ui/LandingButton';
import ScrollReveal from '../../components/ui/ScrollReveal';
import Lightfall from '../Lightfall';
import SoftAurora from '../SoftAurora';
import Aurora from '../Aurora';
import ShapeGrid from '../ShapeGrid';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <ShapeGrid 
          speed={0.2}
          squareSize={48}
          direction="diagonal"
          borderColor="rgba(55, 85, 52, 0.25)"
          hoverFillColor="rgba(209, 126, 94, 0.4)"
          shape="hexagon"
          hoverTrailAmount={6}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-alabaster/40 to-alabaster z-10" />
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-20 md:pt-40 md:pb-32 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left: Brand + CTA */}
          <div className="lg:col-span-5 space-y-8">
            <ScrollReveal direction="fade" delay={0}>
              <div className="space-y-1">
                <h2 className="text-5xl md:text-7xl font-serif font-black tracking-tight leading-[0.95]">
                  Orbit
                </h2>
                <p className="text-xs uppercase tracking-[0.25em] font-semibold text-forest">
                  Orbit
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={150}>
              <PrimaryButton to="/app">Enter Orbit</PrimaryButton>
            </ScrollReveal>
          </div>

          {/* Right: Headline */}
          <div className="lg:col-span-7 space-y-8">
            <ScrollReveal direction="up" delay={200}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-black tracking-tight leading-[1.05]">
                Your life,
                <br />
                <span className="text-forest">understood.</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={350}>
              <p className="text-base md:text-lg text-charcoal/70 font-sans max-w-lg leading-relaxed">
                Orbit is an intelligent companion that helps you understand what is
                happening in your life, what needs your attention, and what you can do next.
              </p>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={500}>
              <SecondaryButton href="#system">Explore the system</SecondaryButton>
            </ScrollReveal>
          </div>
        </div>

        {/* Scroll indicator */}
        <ScrollReveal direction="fade" delay={800} className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block">
          <div className="flex flex-col items-center gap-2 text-charcoal/30">
            <span className="text-[10px] uppercase tracking-widest font-semibold">Scroll</span>
            <div className="w-px h-8 bg-charcoal/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-charcoal/40 animate-scroll-line" />
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
