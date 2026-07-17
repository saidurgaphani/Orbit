import React, { useState } from 'react';
import { Shield, MapPin, Calendar, Check, ArrowRight } from 'lucide-react';
import { auth } from '../firebase';

const BACKEND = 'http://localhost:5001';

export default function OnboardingWizard({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationRequesting, setLocationRequesting] = useState(false);

  const requestLocation = () => {
    setLocationRequesting(true);
    if (!navigator.geolocation) {
      alert('Location services are not supported by your browser.');
      setLocationRequesting(false);
      setStep(2);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationGranted(true);
        setLocationRequesting(false);
        setStep(2);
      },
      () => {
        setLocationRequesting(false);
        setStep(2); // continue to next step anyway
      },
      { timeout: 8000 }
    );
  };

  const handleLinkGoogle = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        alert('Authentication session is missing. Please sign in again.');
        return;
      }
      window.location.href = `${BACKEND}/auth/google?token=${idToken}&referer=${encodeURIComponent(window.location.href)}`;
    } catch (err) {
      console.error('Failed to get Firebase token for Google OAuth:', err);
      alert('Failed to connect to Google Account.');
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="w-full max-w-md border border-charcoal bg-alabaster p-8 md:p-10 shadow-[8px_8px_0px_0px_rgba(39,39,39,1)] relative">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-forest block mb-2">
          [ ORBIT INITIAL ONBOARDING ]
        </span>
        
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-black tracking-tight mb-2">
                Configure Environment & Location
              </h2>
              <p className="text-xs text-charcoal/70 leading-relaxed font-sans">
                Orbit needs location permissions to synchronize real-time meteorological data and customize recommendations for your current environment.
              </p>
            </div>

            <div className="border border-charcoal/20 p-5 bg-alabaster/50 flex items-start gap-4">
              <div className="bg-forest/10 p-2 border border-forest/20 text-forest shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-1">Local Meteorological Matrix</h4>
                <p className="text-[10px] text-charcoal/60 leading-relaxed">
                  Allows local forecast updates, atmospheric telemetry, and localized daily activity briefings.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationRequesting}
                className="w-full bg-forest text-alabaster font-mono py-3 text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:border-charcoal border border-forest transition-colors flex items-center justify-center gap-2"
              >
                {locationRequesting ? 'REQUESTING ACCESS...' : 'GRANT LOCATION ACCESS'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full text-charcoal/60 hover:text-charcoal text-[10px] uppercase tracking-wider py-2 font-bold"
              >
                Skip Location Settings
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-black tracking-tight mb-2">
                Authorize Health & Schedule Sync
              </h2>
              <p className="text-xs text-charcoal/70 leading-relaxed font-sans">
                To build your unified daily brief and calendar timeline without hardcoded placeholders, link your Google Workspace (Calendar & Fit APIs).
              </p>
            </div>

            <div className="space-y-3">
              <div className="border border-charcoal/20 p-4 bg-alabaster/50 flex items-start gap-3">
                <div className="bg-forest/10 p-1.5 border border-forest/20 text-forest shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Unified Calendar Ledger</h4>
                  <p className="text-[9px] text-charcoal/60">
                    Tracks events, meetings, and obligations to construct your daily schedule timeline automatically.
                  </p>
                </div>
              </div>
              <div className="border border-charcoal/20 p-4 bg-alabaster/50 flex items-start gap-3">
                <div className="bg-forest/10 p-1.5 border border-forest/20 text-forest shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Biometric Telemetry (Google Fit)</h4>
                  <p className="text-[9px] text-charcoal/60">
                    Extracts real step counts, sleep cycles, workouts, and resting heart rates dynamically.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleLinkGoogle}
                className="w-full bg-forest text-alabaster font-mono py-3 text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:border-charcoal border border-forest transition-colors flex items-center justify-center gap-2"
              >
                LINK GOOGLE ACCOUNT
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onComplete}
                className="w-full text-charcoal/60 hover:text-charcoal text-[10px] uppercase tracking-wider py-2 font-bold"
              >
                Configure Manually Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
