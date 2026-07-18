import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sun, 
  CloudSun, 
  Sunset, 
  Heart, 
  Coins, 
  GraduationCap, 
  Target, 
  ShieldAlert, 
  Sparkles, 
  ArrowRight, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function Home({ userLocation, onNavigateToTab, selectedDate }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  // 1. Fetch Home Brief Dashboard data scoped to selectedDate
  const fetchBrief = useCallback(async (forceRegen = false) => {
    if (forceRegen) setRegenerating(true);
    else setLoading(true);
    setError('');

    try {
      const queryParams = `?date=${selectedDate}`;
      const endpoint = forceRegen 
        ? `${BACKEND}/home/generate${queryParams}` 
        : `${BACKEND}/home/dashboard${queryParams}`;
        
      const res = await fetch(endpoint, {
        method: forceRegen ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: forceRegen ? JSON.stringify({ lat: userLocation?.lat, lon: userLocation?.lon }) : undefined
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to sync home brief.');
      }

      const data = await res.json();
      setBrief(data);
    } catch (err) {
      setError(err.message || 'Error communicating with daily intelligence engine.');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, [userLocation, selectedDate]);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  // Live time ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const getGreetingIcon = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return Sun;
    if (hrs < 18) return CloudSun;
    return Sunset;
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse w-full pb-12">
        {/* Welcome Banner Skeleton */}
        <div className="border border-charcoal/10 p-8 md:p-10 bg-alabaster/50 space-y-4">
          <div className="h-4 w-1/4 bg-charcoal/10 rounded" />
          <div className="h-8 w-2/3 bg-charcoal/15 rounded" />
          <div className="h-6 w-full bg-charcoal/5 rounded" />
        </div>

        {/* Vitality Score Skeleton */}
        <div className="border border-charcoal/10 p-6 md:p-8 bg-alabaster/50 space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-6 w-1/4 bg-charcoal/10 rounded" />
            <div className="h-6 w-20 bg-charcoal/10 rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-4 flex flex-col items-center justify-center space-y-2">
              <div className="h-16 w-24 bg-charcoal/15 rounded" />
              <div className="h-4 w-20 bg-charcoal/10 rounded" />
            </div>
            <div className="md:col-span-8 grid grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 bg-charcoal/5 border border-charcoal/10 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-terracotta p-6 bg-terracotta/5 text-terracotta space-y-4 flex flex-col items-start">
        <div className="text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 text-terracotta">
          <AlertCircle className="w-4 h-4" />
          <span>[ INTELLIGENCE MODULE EXCEPTION ]</span>
        </div>
        <p className="text-sm font-sans">{error}</p>
        <button
          onClick={() => fetchBrief(true)}
          className="border border-terracotta px-4 py-2 text-xs uppercase font-bold tracking-wider hover:bg-terracotta hover:text-alabaster transition-colors"
        >
          Retry Assembling Home
        </button>
      </div>
    );
  }

  if (!brief) return null;

  const GreetingIcon = getGreetingIcon();

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn w-full pb-12">
      
      {/* SECTION 1: WELCOME BANNER (Calm Editorial Layout) */}
      <div className="border border-charcoal p-5 sm:p-8 md:p-10 bg-alabaster relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-forest text-[10px] sm:text-xs font-semibold uppercase tracking-widest">
            <GreetingIcon className="w-4 h-4 text-forest" />
            <span>{getFormattedDate()}</span>
            <span>&bull;</span>
            <span>{currentTime}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black tracking-tight leading-none md:leading-tight">
            {brief.greeting || 'Good Morning, Sai'}
          </h2>
          <p className="text-sm sm:text-base md:text-lg font-serif italic text-charcoal/80 max-w-xl leading-normal sm:leading-relaxed">
            &ldquo;{brief.welcomeSentence}&rdquo;
          </p>
        </div>
        <button
          onClick={() => fetchBrief(true)}
          disabled={regenerating}
          className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase font-bold tracking-wider transition-colors shrink-0 flex items-center gap-1.5"
        >
          {regenerating && <RefreshCw className="w-3 h-3 animate-spin" />}
          <span>{regenerating ? 'Regenerating...' : 'Regenerate Brief'}</span>
        </button>
      </div>

      {/* SECTION 2: LIFE SCORE PANEL */}
      <div className="border border-charcoal p-5 sm:p-8 bg-alabaster">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4">
          <div>
            <span className="text-[10px] sm:text-xs uppercase font-semibold tracking-wider text-charcoal/60">[ METRIC SYNTHESIS ]</span>
            <h3 className="text-lg sm:text-xl font-serif font-bold mt-1">Today's Life Score</h3>
          </div>
          <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 sm:px-3 sm:py-1 border ${
            brief.score >= 80 ? 'border-forest text-forest bg-forest/5' :
            brief.score >= 60 ? 'border-charcoal text-charcoal/80 bg-charcoal/5' :
            'border-terracotta text-terracotta bg-terracotta/5'
          }`}>
            {brief.score >= 80 ? 'OPTIMIZED FLOW' : brief.score >= 60 ? 'STABLE' : 'ACTION REQUIRED'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Big Score Radial/Guage */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-charcoal/15 pb-4 lg:pb-0 lg:pr-6 py-2">
            <div className="flex items-baseline gap-1">
              <span className="text-6xl sm:text-7xl font-serif font-black tracking-tighter">{brief.score}</span>
              <span className="text-charcoal/40 text-lg sm:text-xl font-serif">/100</span>
            </div>
            <p className="text-[10px] sm:text-xs uppercase tracking-wider font-sans font-bold text-charcoal/70 mt-1">Overall Vitality</p>
          </div>

          {/* Breakdown Categories Grid */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {[
              { label: 'Health', val: brief.breakdown?.health ?? 87, tab: 'health', icon: Heart },
              { label: 'Finance', val: brief.breakdown?.finance ?? 81, tab: 'finance', icon: Coins },
              { label: 'Learning', val: brief.breakdown?.learning ?? 92, tab: 'goals', icon: GraduationCap },
              { label: 'Goals', val: brief.breakdown?.goals ?? 76, tab: 'goals', icon: Target },
              { label: 'Security', val: brief.breakdown?.security ?? 98, tab: 'scam', icon: ShieldAlert }
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.label}
                  onClick={() => onNavigateToTab && onNavigateToTab(cat.tab)}
                  className="border border-charcoal/15 hover:border-forest p-2 sm:p-3 bg-alabaster/60 hover:bg-forest/[0.02] flex flex-col items-center justify-between text-center transition-all group hover:-translate-y-0.5 min-w-0"
                >
                  <Icon className="w-4 h-4 text-charcoal/70 mb-1 group-hover:text-forest transition-colors" />
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-charcoal/60 group-hover:text-forest transition-colors whitespace-nowrap truncate w-full">
                    {cat.label}
                  </span>
                  <span className="text-base sm:text-lg font-serif font-bold text-charcoal mt-1">{cat.val}</span>
                  <span className="text-[9px] uppercase tracking-widest text-forest font-bold opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                    Go &rarr;
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TWO COLUMN SUMMARY: Priorities (S3) & Recommendations (S4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 3: TODAY'S PRIORITIES */}
        <div className="border border-charcoal p-6 bg-alabaster flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-charcoal/60 block mb-4">
              [ CHRONOLOGICAL URGENCY ]
            </span>
            <h3 className="text-lg font-serif font-bold mb-4 border-b border-charcoal/15 pb-2">Today's Priorities</h3>
            
            {brief.priorities && brief.priorities.length > 0 ? (
              <div className="space-y-4">
                {brief.priorities.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-l-2 border-charcoal pl-3 py-0.5">
                    <div>
                      <h4 className="text-sm font-sans font-bold text-charcoal">{item.title}</h4>
                      <p className="text-xs text-charcoal/50 font-sans mt-0.5">{item.time}</p>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 border ${
                      item.urgency === 'High' ? 'border-terracotta text-terracotta bg-terracotta/5' :
                      item.urgency === 'Medium' ? 'border-charcoal text-charcoal/80 bg-charcoal/5' :
                      'border-charcoal/30 text-charcoal/40 bg-alabaster'
                    }`}>
                      {item.urgency}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic font-serif text-charcoal/40">No immediate priorities identified.</p>
            )}
          </div>
        </div>

        {/* SECTION 4: AI RECOMMENDED ACTIONS */}
        <div className="border border-charcoal p-6 bg-alabaster flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-charcoal/60 block mb-4">
              [ AI DIRECTIVES ]
            </span>
            <h3 className="text-lg font-serif font-bold mb-4 border-b border-charcoal/15 pb-2">AI Recommendations</h3>

            {brief.recommendations && brief.recommendations.length > 0 ? (
              <ul className="space-y-3">
                {brief.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs font-sans leading-relaxed text-charcoal/80 flex items-start gap-2">
                    <span className="text-forest font-bold select-none mt-0.5">&rarr;</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic font-serif text-charcoal/40">No recommended actions generated.</p>
            )}
          </div>
        </div>
      </div>

      {/* SNAPSHOTS GRID (Section 5, 6, 7, 8, 9) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* SECTION 5: HEALTH SNAPSHOT */}
        <div 
          onClick={() => onNavigateToTab && onNavigateToTab('health')}
          className="border border-charcoal p-5 bg-alabaster hover:border-forest cursor-pointer transition-all group relative"
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60 group-hover:text-forest">
              Health Snapshot
            </span>
            <span className="text-xs group-hover:translate-x-1 transition-transform">&rarr;</span>
          </div>
          {brief.healthSnapshot ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-charcoal/5 pb-1">
                <span className="text-charcoal/60">Sleep</span>
                <span className="font-bold">{brief.healthSnapshot.sleep}</span>
              </div>
              <div className="flex justify-between border-b border-charcoal/5 pb-1">
                <span className="text-charcoal/60">Steps</span>
                <span className="font-bold">{brief.healthSnapshot.steps}</span>
              </div>
              <div className="flex justify-between border-b border-charcoal/5 pb-1">
                <span className="text-charcoal/60">Heart Rate</span>
                <span className="font-bold">{brief.healthSnapshot.heartRate}</span>
              </div>
              <div className="flex justify-between border-b border-charcoal/5 pb-1">
                <span className="text-charcoal/60">Water</span>
                <span className="font-bold">{brief.healthSnapshot.water}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal/60">Workout</span>
                <span className={`font-extrabold ${brief.healthSnapshot.workout === 'Completed' ? 'text-forest' : 'text-charcoal/50'}`}>
                  {brief.healthSnapshot.workout}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs italic text-charcoal/40">No health logs today.</p>
          )}
        </div>

        {/* SECTION 6: FINANCE SNAPSHOT */}
        <div 
          onClick={() => onNavigateToTab && onNavigateToTab('finance')}
          className="border border-charcoal p-5 bg-alabaster hover:border-forest cursor-pointer transition-all group relative"
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60 group-hover:text-forest">
              Finance Snapshot
            </span>
            <span className="text-xs group-hover:translate-x-1 transition-transform">&rarr;</span>
          </div>
          {brief.financeSnapshot ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-charcoal/5 pb-1">
                <span className="text-charcoal/60">Budget</span>
                <span className="font-bold">{brief.financeSnapshot.monthlyBudget}</span>
              </div>
              <div className="flex justify-between border-b border-charcoal/5 pb-1">
                <span className="text-charcoal/60">Spent</span>
                <span className="font-bold">{brief.financeSnapshot.spent}</span>
              </div>
              <div className="flex justify-between border-b border-charcoal/5 pb-1">
                <span className="text-charcoal/60">Remaining</span>
                <span className="font-bold text-forest">{brief.financeSnapshot.remaining}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal/60">Bills Due</span>
                <span className={`font-extrabold ${brief.financeSnapshot.billsDue > 0 ? 'text-terracotta' : 'text-forest'}`}>
                  {brief.financeSnapshot.billsDue}
                </span>
              </div>
              <p className="text-[9px] italic text-charcoal/60 border-t border-charcoal/10 pt-2 leading-relaxed">
                {brief.financeSnapshot.note}
              </p>
            </div>
          ) : (
            <p className="text-xs italic text-charcoal/40">No ledger entries loaded.</p>
          )}
        </div>

        {/* SECTION 7: CALENDAR SNAPSHOT */}
        <div className="border border-charcoal p-5 bg-alabaster hover:border-forest transition-all group relative">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60 group-hover:text-forest">
              Calendar Status
            </span>
          </div>
          {brief.calendarSnapshot && brief.calendarSnapshot.length > 0 ? (
            <div className="space-y-2.5 text-xs">
              {brief.calendarSnapshot.map((evt, idx) => (
                <div key={idx} className="border-b border-charcoal/5 pb-1 flex justify-between items-start gap-2">
                  <span className="text-charcoal truncate flex-1 leading-tight">{evt.title}</span>
                  <span className="text-[9px] uppercase border border-charcoal/30 px-1 py-0.2 shrink-0 select-none">
                    {evt.time}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[10px] italic text-charcoal/40 font-serif">No calendar events for today.</p>
            </div>
          )}
        </div>
      </div>

      {/* ADDITIONAL SECTIONS: Documents (S8) & Learning (S9) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* SECTION 8: DOCUMENTS SNAPSHOT */}
        <div 
          onClick={() => onNavigateToTab && onNavigateToTab('docs')}
          className="border border-charcoal p-5 bg-alabaster hover:border-forest cursor-pointer transition-all group relative"
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60 group-hover:text-forest">
              Documents Intelligence
            </span>
            <span className="text-xs group-hover:translate-x-1 transition-transform">&rarr;</span>
          </div>
          {brief.documentsSnapshot && brief.documentsSnapshot.length > 0 ? (
            <div className="space-y-2 text-xs">
              {brief.documentsSnapshot.map((doc, idx) => (
                <div key={idx} className="flex justify-between border-b border-charcoal/5 pb-1">
                  <span className="text-charcoal font-semibold">{doc.name}</span>
                  <span className={`font-medium ${doc.status.includes('Expires') || doc.status.includes('Renewal') ? 'text-terracotta font-bold' : 'text-charcoal/55'}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-charcoal/40">No documents catalogued.</p>
          )}
        </div>

        {/* SECTION 9: LEARNING SNAPSHOT */}
        <div className="border border-charcoal p-5 bg-alabaster hover:border-forest transition-all group relative">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60 group-hover:text-forest">
              Learning Curriculum
            </span>
          </div>
          {brief.learningSnapshot && brief.learningSnapshot.length > 0 ? (
            <div className="space-y-2 text-xs">
              {brief.learningSnapshot.map((item, idx) => (
                <div key={idx} className="flex justify-between border-b border-charcoal/5 pb-1">
                  <span className="text-charcoal">{item.subject}</span>
                  <span className="text-charcoal/55 font-bold">{item.duration}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-charcoal/40">No active study plan found.</p>
          )}
        </div>
      </div>

      {/* SECTION 10: DAILY CHALLENGE & SECTION 11: EVENING REFLECTION PREVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* SECTION 10: DAILY CHALLENGE */}
        <div className="border border-charcoal p-6 bg-alabaster flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-3 top-3 border border-forest/40 bg-forest/5 text-forest text-[9px] font-black tracking-widest px-2 py-0.5 select-none">
            GAMIFICATION ACTIVE
          </div>
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-charcoal/60 block mb-3">
              [ LIFE SCORE REWARD ]
            </span>
            <h3 className="text-lg font-serif font-bold">{brief.dailyChallenge?.title || 'Walk 10,000 steps today'}</h3>
            <p className="text-xs text-charcoal/70 font-sans mt-1 leading-relaxed">
              Completing this activity awards you <span className="font-extrabold text-forest">{brief.dailyChallenge?.reward || '+5 Health Score'}</span> points.
            </p>
          </div>
        </div>

        {/* SECTION 11: EVENING REFLECTION PREVIEW */}
        <div className="border border-charcoal border-dashed p-6 bg-alabaster/40 flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-charcoal/60 block mb-3">
              [ DIARY SEQUENCE PREVIEW ]
            </span>
            <h3 className="text-sm font-serif font-bold text-charcoal/70">
              {brief.reflectionPreview?.title || "Tonight Orbit will summarize:"}
            </h3>
            <ul className="text-xs font-sans text-charcoal/50 space-y-1 mt-2 list-disc list-inside">
              {brief.reflectionPreview?.bullets?.map((b, idx) => (
                <li key={idx}>{b}</li>
              )) || (
                <>
                  <li>Health logs & Sleep quality</li>
                  <li>Day's expenses vs daily allowance</li>
                  <li>Productivity & Learning progress</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* SECTION 12: QUICK ACTIONS SHUTTLE */}
      <div className="border border-charcoal p-5 bg-alabaster">
        <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60 block mb-3">
          [ QUICK ACTIONS SHUTTLE ]
        </span>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => onNavigateToTab && onNavigateToTab('dashboard')}
            className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-4 py-2 text-xs uppercase font-bold tracking-wider transition-colors bg-alabaster"
          >
            Open Chat
          </button>
          <button 
            onClick={() => onNavigateToTab && onNavigateToTab('finance')}
            className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-4 py-2 text-xs uppercase font-bold tracking-wider transition-colors bg-alabaster"
          >
            Pay Bill
          </button>
          <button 
            onClick={() => onNavigateToTab && onNavigateToTab('docs')}
            className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-4 py-2 text-xs uppercase font-bold tracking-wider transition-colors bg-alabaster"
          >
            Upload Document
          </button>
          <button 
            onClick={() => onNavigateToTab && onNavigateToTab('finance')}
            className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-4 py-2 text-xs uppercase font-bold tracking-wider transition-colors bg-alabaster"
          >
            Track Expense
          </button>
        </div>
      </div>

    </div>
  );
}
