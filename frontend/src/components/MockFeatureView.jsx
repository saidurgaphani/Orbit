import React, { useState, useEffect } from 'react';

export default function MockFeatureView({ feature, onBack }) {
  const [loading, setLoading] = useState(true);

  // Simulate network delay to make the mock feel real
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [feature.id]);

  return (
    <div className="border border-charcoal p-6 md:p-8 bg-alabaster">
      <div className="border-b border-charcoal pb-4 mb-6 flex justify-between items-start">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-1">
            [ {feature.category || 'EXTENDED MODULE'} ]
          </span>
          <h2 className="text-3xl font-serif mt-1 font-semibold">{feature.name}</h2>
          <p className="text-sm text-charcoal/70 mt-1 font-sans max-w-2xl">
            {feature.description}
          </p>
        </div>
        <button 
          onClick={onBack}
          className="text-xs uppercase font-bold tracking-wider text-charcoal/60 hover:text-charcoal border border-transparent hover:border-charcoal/20 px-3 py-1.5 transition-colors"
        >
          &larr; Return to Grid
        </button>
      </div>

      {loading ? (
        <div className="mt-8 border border-dashed border-charcoal p-12 text-center bg-alabaster">
          <div className="font-serif italic text-lg animate-pulse text-charcoal/80 mb-2">
            Establishing secure connection to {feature.name} core...
          </div>
          <div className="text-[10px] uppercase tracking-widest text-charcoal/40 font-mono">
            Handshake / Auth / Payload Retrieval
          </div>
        </div>
      ) : (
        <div className="animate-fadeIn space-y-6">
          
          <div className="border border-charcoal p-6 bg-alabaster">
             <div className="flex justify-between items-start mb-4">
              <span className="text-xs uppercase font-bold tracking-wider text-forest block">
                [ MODULE ACTIVE ]
              </span>
              <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 border border-charcoal/20 px-2 py-0.5">
                STATUS: OPTIMIZED
              </span>
            </div>
            <p className="font-serif text-lg leading-relaxed text-charcoal italic mb-4">
              "{feature.mockSummary || `This module operates continuously in the background, indexing data and identifying patterns.`}"
            </p>
          </div>

          {feature.mockData && feature.mockData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-charcoal p-5 bg-alabaster">
                <span className="text-xs uppercase font-semibold tracking-wider text-charcoal/60 block mb-3">
                  [ RECENT INSIGHTS ]
                </span>
                <ul className="space-y-4">
                  {feature.mockData.map((item, idx) => (
                    <li key={idx} className="border-b border-charcoal/10 pb-3 last:border-0 last:pb-0">
                      <h4 className="text-sm font-bold font-sans text-charcoal">{item.title}</h4>
                      <p className="text-xs text-charcoal/70 mt-1">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border border-charcoal p-5 bg-alabaster flex flex-col justify-center items-center text-center h-full min-h-[200px]">
                <span className="text-3xl mb-3 text-charcoal/40">⊚</span>
                <h4 className="text-sm font-bold uppercase tracking-wider text-charcoal/60 mb-2">
                  Interactive UI Reserved
                </h4>
                <p className="text-xs text-charcoal/40 max-w-[200px]">
                  Direct input mechanisms for this module are currently handled by the global EVA orchestrator.
                </p>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
