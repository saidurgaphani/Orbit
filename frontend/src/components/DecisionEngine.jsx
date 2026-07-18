import React, { useState, useCallback, useEffect, useRef } from 'react';
import { auth } from '../firebase';
import { 
  Coins, 
  Heart, 
  Briefcase, 
  GraduationCap, 
  Globe, 
  Scale, 
  Brain, 
  Calendar, 
  FileText, 
  BookOpen, 
  Target, 
  Zap, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  ArrowLeft, 
  ArrowRight,
  Clock,
  History,
  AlertCircle,
  Search
} from 'lucide-react';


const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DOMAIN_META = {
  financial: { icon: Coins, label: 'Financial', color: 'text-forest border-forest' },
  health:    { icon: Heart, label: 'Health',    color: 'text-terracotta border-terracotta' },
  career:    { icon: Briefcase, label: 'Career',    color: 'text-charcoal border-charcoal' },
  education: { icon: GraduationCap, label: 'Education', color: 'text-forest border-forest' },
  lifestyle: { icon: Globe, label: 'Lifestyle', color: 'text-charcoal border-charcoal' },
  legal:     { icon: Scale, label: 'Legal',     color: 'text-terracotta border-terracotta' },
  general:   { icon: Brain, label: 'General',   color: 'text-forest border-forest' },
};

const DATA_SOURCE_META = {
  finance:   { icon: Coins, label: 'Finance' },
  health:    { icon: Heart, label: 'Health' },
  calendar:  { icon: Calendar, label: 'Calendar' },
  documents: { icon: FileText, label: 'Documents' },
  learning:  { icon: BookOpen, label: 'Learning' },
  goals:     { icon: Target, label: 'Goals' },
  career:    { icon: Briefcase, label: 'Career' },
};

const EXAMPLE_QUESTIONS = [
  { q: 'Can I afford a MacBook this month?', domain: 'financial' },
  { q: 'Should I work out today?', domain: 'health' },
  { q: 'Should I travel next month?', domain: 'lifestyle' },
  { q: 'Am I sleeping enough?', domain: 'health' },
  { q: 'Should I accept this job offer?', domain: 'career' },
  { q: 'Can I skip today\'s workout?', domain: 'health' },
  { q: 'Should I invest this month?', domain: 'financial' },
  { q: 'Should I take another course?', domain: 'education' },
];

const THINKING_STEPS = [
  { label: 'Detecting intent', icon: Brain },
  { label: 'Pulling Health data', icon: Heart },
  { label: 'Pulling Finance data', icon: Coins },
  { label: 'Checking Calendar', icon: Calendar },
  { label: 'Scanning Documents', icon: FileText },
  { label: 'Cross-domain reasoning', icon: Zap },
  { label: 'Generating recommendation', icon: Sparkles },
];

const NAV_ACTION_MAP = {
  'Check Budget': 'finance',
  'Review Bills': 'finance',
  'Set Savings Goal': 'finance',
  'View Health': 'health',
  'Log Workout': 'health',
  'Check Steps': 'health',
  'Log Sleep': 'health',
  'View Calendar': 'calendar',
  'View Documents': 'documents',
  'Review Documents': 'documents',
  'View Goals': 'goals',
  'View Learning': 'learning',
  'View Dashboard': 'home',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function confidenceColor(c) {
  if (c >= 76) return { bar: 'bg-forest', text: 'text-forest', border: 'border-forest', label: 'High' };
  if (c >= 51) return { bar: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-400', label: 'Medium' };
  return { bar: 'bg-terracotta', text: 'text-terracotta', border: 'border-terracotta', label: 'Low' };
}

function formatRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function impactIcon(text) {
  if (text.startsWith('✓')) return 'positive';
  if (text.startsWith('✗')) return 'negative';
  return 'neutral';
}

// ─── THINKING PIPELINE ───────────────────────────────────────────────────────
function ThinkingPipeline({ active }) {
  const [step, setStep] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) { setStep(0); return; }
    setStep(0);
    let current = 0;
    intervalRef.current = setInterval(() => {
      current++;
      setStep(current);
      if (current >= THINKING_STEPS.length - 1) {
        clearInterval(intervalRef.current);
      }
    }, 700);
    return () => clearInterval(intervalRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <div className="border border-charcoal p-6 bg-alabaster animate-fadeIn">
      <div className="text-xs uppercase font-bold tracking-wider text-forest mb-5">[ MULTI-AGENT REASONING PIPELINE ]</div>
      <div className="space-y-3">
        {THINKING_STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const pending = i > step;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className={`w-7 h-7 flex items-center justify-center border text-xs font-bold shrink-0 transition-all ${
                done ? 'bg-charcoal border-charcoal text-alabaster' :
                current ? 'border-forest text-forest animate-pulse' :
                'border-charcoal/20 text-charcoal/30'
              }`}>
                {done ? (
                  <Check className="w-4 h-4 stroke-[3px]" />
                ) : current ? (
                  React.createElement(s.icon, { className: "w-3.5 h-3.5" })
                ) : (
                  <span className="text-[10px]">{i + 1}</span>
                )}
              </span>
              <span className={`text-sm font-sans transition-all ${
                done ? 'text-charcoal/50' :
                current ? 'text-charcoal font-semibold' :
                'text-charcoal/30'
              }`}>
                {s.label}
              </span>
              {current && (
                <span className="ml-auto text-[10px] uppercase tracking-wider text-forest font-bold animate-pulse">
                  Running...
                </span>
              )}
              {done && (
                <span className="ml-auto text-[10px] uppercase tracking-wider text-charcoal/40">Done</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CONFIDENCE METER ─────────────────────────────────────────────────────────
function ConfidenceMeter({ confidence }) {
  let label = 'Medium';
  let percentage = 60;
  let barColor = 'bg-amber-500';
  let textColor = 'text-amber-600';
  let borderColor = 'border-amber-400';

  if (typeof confidence === 'string') {
    const upper = confidence.toUpperCase();
    if (upper === 'HIGH') {
      label = 'High';
      percentage = 90;
      barColor = 'bg-forest';
      textColor = 'text-forest';
      borderColor = 'border-forest';
    } else if (upper === 'LOW') {
      label = 'Low';
      percentage = 30;
      barColor = 'bg-terracotta';
      textColor = 'text-terracotta';
      borderColor = 'border-terracotta';
    }
  } else if (typeof confidence === 'number') {
    percentage = Math.min(100, Math.max(0, confidence));
    if (percentage >= 75) {
      label = 'High';
      barColor = 'bg-forest';
      textColor = 'text-forest';
      borderColor = 'border-forest';
    } else if (percentage <= 35) {
      label = 'Low';
      barColor = 'bg-terracotta';
      textColor = 'text-terracotta';
      borderColor = 'border-terracotta';
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-charcoal/10 relative overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-700`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${textColor} ${borderColor} bg-alabaster shrink-0`}>
        {label} Confidence — {percentage}%
      </span>
    </div>
  );
}

// ─── RECOMMENDATION RESULT ────────────────────────────────────────────────────
function DecisionResult({ result, onNavigate, onFeedback }) {
  const [showReasoning, setShowReasoning] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState(null);

  const summary = result.context_summary || {};
  const category = summary.category || 'general';
  const domain = DOMAIN_META[category] || DOMAIN_META.general;

  // Compile active data sources from backend flags
  const dataAvailable = summary.data_available || {};
  const activeSources = [];
  if (dataAvailable.has_income) activeSources.push('finance');
  if (dataAvailable.has_expense_records) activeSources.push('finance');
  if (dataAvailable.has_goals) activeSources.push('goals');
  if (dataAvailable.has_health_records) activeSources.push('health');
  if (dataAvailable.has_habits) activeSources.push('health');
  if (summary.rag_chunks_used > 0) activeSources.push('documents');

  const handleFeedback = async (outcome) => {
    setFeedbackGiven(outcome);
    if (result.decisionId) {
      try {
        await fetch(`${BACKEND}/decision/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decisionId: result.decisionId, outcome }),
        });
      } catch { /* non-fatal */ }
    }
    onFeedback?.(outcome);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header + Domain */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {React.createElement(domain.icon, { className: "w-4.5 h-4.5 text-charcoal/80 stroke-[2px]" })}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${domain.color}`}>
            {domain.label} Decision
          </span>
        </div>
        {[...new Set(activeSources)].length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {[...new Set(activeSources)].map(src => {
              const meta = DATA_SOURCE_META[src] || { icon: null, label: src };
              const Icon = meta.icon;
              return (
                <span key={src} className="text-[9px] uppercase tracking-wider font-bold text-charcoal/50 border border-charcoal/20 px-1.5 py-1 flex items-center gap-1.5">
                  {Icon && <Icon className="w-3.5 h-3.5 text-charcoal/50" />}
                  <span>{meta.label}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Primary Recommendation Card */}
      <div className="border border-charcoal p-6 bg-alabaster shadow-[4px_4px_0px_0px_rgba(30,32,30,0.12)] animate-fadeIn">
        <span className="text-xs uppercase font-bold tracking-wider text-forest block mb-3">[ DECISION ]</span>
        <p className="font-serif text-xl leading-snug text-charcoal font-semibold mb-5">
          "{result.decision}"
        </p>
        <ConfidenceMeter confidence={result.confidence} />
      </div>

      {/* Why / Reasoning */}
      <div className="border border-charcoal/30 bg-alabaster">
        <button
          onClick={() => setShowReasoning(v => !v)}
          className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-charcoal/5 transition-colors"
        >
          <span className="text-xs uppercase font-bold tracking-wider text-charcoal/60">[ WHY? ] Reasoning</span>
          <span className="text-charcoal/40 text-sm">
            {showReasoning ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {showReasoning && (
          <div className="px-5 pb-5 border-t border-charcoal/10 pt-4">
            <p className="text-sm font-sans text-charcoal/80 leading-relaxed whitespace-pre-line">
              {result.reasoning}
            </p>
          </div>
        )}
      </div>

      {/* Trade-offs & Risks side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trade-offs */}
        <div className="border border-charcoal/30 p-5 bg-alabaster">
          <div className="text-xs font-bold uppercase tracking-wider text-forest mb-3 flex items-center gap-2">
            <Scale className="w-4.5 h-4.5 text-forest" />
            <span>[ TRADE-OFFS ]</span>
          </div>
          <ul className="space-y-2">
            {(result.tradeoffs || []).map((t, idx) => (
              <li key={idx} className="text-xs font-sans text-charcoal/70 flex items-start gap-2">
                <span className="text-forest shrink-0 font-bold">↳</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
            {(!result.tradeoffs || result.tradeoffs.length === 0) && (
              <li className="text-xs font-sans text-charcoal/40 italic">No significant trade-offs identified.</li>
            )}
          </ul>
        </div>

        {/* Risks */}
        <div className="border border-charcoal/30 p-5 bg-alabaster">
          <div className="text-xs font-bold uppercase tracking-wider text-terracotta mb-3 flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-terracotta" />
            <span>[ RISKS ]</span>
          </div>
          <ul className="space-y-2">
            {(result.risks || []).map((r, idx) => (
              <li key={idx} className="text-xs font-sans text-terracotta/90 flex items-start gap-2">
                <span className="shrink-0 font-bold">⚠️</span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
            {(!result.risks || result.risks.length === 0) && (
              <li className="text-xs font-sans text-charcoal/40 italic">No major risks identified.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Missing Information Block */}
      {result.missing_information && result.missing_information.length > 0 && (
        <div className="border border-terracotta/40 p-5 bg-terracotta/[0.02] border-dashed">
          <div className="text-xs font-bold uppercase tracking-wider text-terracotta mb-2">[ MISSING INFORMATION ]</div>
          <ul className="space-y-1.5">
            {result.missing_information.map((info, idx) => (
              <li key={idx} className="text-xs font-sans text-charcoal/80 flex items-start gap-2">
                <span className="text-terracotta shrink-0 font-black">?</span>
                <span className="leading-relaxed">{info}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Step Action Card */}
      {result.next_step && (
        <div className="border border-charcoal p-5 bg-charcoal text-alabaster shadow-[3px_3px_0px_0px_rgba(68,107,79,0.3)] animate-fadeIn">
          <div className="text-xs font-bold uppercase tracking-wider text-forest mb-2">[ NEXT STEP ]</div>
          <p className="font-serif text-sm italic mb-1 leading-relaxed">
            "{result.next_step}"
          </p>
        </div>
      )}

      {/* Feedback */}
      {!feedbackGiven ? (
        <div className="border-t border-charcoal/10 pt-4 flex items-center gap-3">
          <span className="text-xs text-charcoal/40 font-sans">Was this helpful?</span>
          <button
            onClick={() => handleFeedback('positive')}
            className="text-xs font-bold uppercase tracking-wider text-forest border border-forest/50 px-3 py-1.5 hover:bg-forest hover:text-alabaster transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Yes</span>
          </button>
          <button
            onClick={() => handleFeedback('negative')}
            className="text-xs font-bold uppercase tracking-wider text-charcoal/50 border border-charcoal/20 px-3 py-1.5 hover:border-terracotta hover:text-terracotta transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>No</span>
          </button>
        </div>
      ) : (
        <div className="border-t border-charcoal/10 pt-4">
          <span className="text-xs text-charcoal/50 font-sans flex items-center gap-1.5">
            {feedbackGiven === 'positive' ? (
              <>
                <Check className="w-4 h-4 text-forest stroke-[2.5px]" />
                <span>Glad this helped!</span>
              </>
            ) : (
              <span>Thank you — Orbit will improve.</span>
            )}
          </span>
        </div>
      )}

    </div>
  );
}

// ─── DECISION HISTORY ─────────────────────────────────────────────────────────
function DecisionHistory({ onClose }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');

  const fetchHistory = async (query = '') => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers = idToken ? { 'Authorization': `Bearer ${idToken}` } : {};
      const url = `${BACKEND}/decision/history${query ? `?search=${encodeURIComponent(query)}` : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDecisions(data.decisions || []);
    } catch (err) {
      console.error('Failed to fetch decision history:', err);
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleFeedback = async (id, outcome) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND}/decision/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ decisionId: id, outcome })
      });
      if (res.ok) {
        setDecisions(prev => prev.map(d => d.id === id ? { ...d, outcome } : d));
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* HEADER */}
      <div className="border-b border-charcoal pb-4 mb-6 flex justify-between items-center">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-1">[ DECISION LOG ]</span>
          <h3 className="text-2xl font-serif font-bold">Past Decisions</h3>
          <p className="text-xs text-charcoal/50 font-sans mt-1">
            Browse and search your decision engine history, recommendations, and outcomes.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold uppercase tracking-wider text-charcoal/50 hover:text-charcoal transition-colors flex items-center gap-1.5 border border-charcoal/20 px-3 py-1.5 hover:border-charcoal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by question, category, or recommendation..."
            className="w-full bg-alabaster border border-charcoal/40 pl-10 pr-4 py-2.5 font-sans text-sm text-charcoal placeholder-charcoal/40 focus:outline-none focus:border-charcoal shadow-[2px_2px_0px_0px_rgba(30,32,30,0.05)]"
          />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-charcoal/40" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-3 text-xs font-bold text-charcoal/40 hover:text-charcoal"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* LOADING STATE */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-charcoal/10 bg-alabaster/40 p-4 animate-pulse space-y-2">
              <div className="h-4 bg-charcoal/10 w-3/4 rounded" />
              <div className="h-3 bg-charcoal/10 w-1/2 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && decisions.length === 0 && (
        <div className="border border-dashed border-charcoal/30 p-12 text-center flex flex-col items-center justify-center bg-alabaster">
          <History className="w-8 h-8 text-charcoal/30 mb-3" />
          <p className="font-serif italic text-charcoal/60">
            {search ? 'No matching decisions found.' : 'No decisions made yet.'}
          </p>
          <p className="text-xs text-charcoal/40 mt-2">
            {search ? 'Try clearing or changing your search terms.' : 'Your analyzed decisions will appear here.'}
          </p>
        </div>
      )}

      {/* DECISION LOG LIST */}
      {!loading && decisions.length > 0 && (
        <div className="space-y-3">
          {decisions.map(d => {
            const domain = DOMAIN_META[d.domain] || DOMAIN_META.general;
            const conf = confidenceColor(d.confidence || 0);
            const isExpanded = expanded === d.id;
            
            // Format full date
            const dateObj = new Date(d.timestamp);
            const fullDateString = dateObj.toLocaleDateString(undefined, { 
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });

            return (
              <div key={d.id} className="border border-charcoal/20 bg-alabaster hover:border-charcoal transition-all shadow-[2px_2px_0px_0px_rgba(30,32,30,0.03)]">
                {/* Header Toggle Row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : d.id)}
                  className="w-full flex items-start gap-4 p-4 text-left hover:bg-charcoal/[0.01] transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    {React.createElement(domain.icon, { className: "w-5 h-5 text-charcoal/70" })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-serif font-bold text-charcoal leading-snug">{d.question}</div>
                    <div className="text-[10px] uppercase font-bold text-charcoal/40 font-mono mt-1 tracking-wider">
                      {fullDateString}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 self-center">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${conf.text} ${conf.border}`}>
                      {d.confidence}% Conf
                    </span>
                    {d.outcome && (
                      <span className={`text-[10px] ${d.outcome === 'positive' ? 'text-forest' : 'text-terracotta'}`}>
                        {d.outcome === 'positive' ? <ThumbsUp className="w-3.5 h-3.5 fill-forest/10" /> : <ThumbsDown className="w-3.5 h-3.5 fill-terracotta/10" />}
                      </span>
                    )}
                    <span className="text-charcoal/30">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </button>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-charcoal/10 pt-4 bg-alabaster/50 animate-fadeIn space-y-4 font-sans text-xs text-charcoal">
                    {/* Recommendation Segment */}
                    <div>
                      <span className="text-[9px] uppercase font-black tracking-widest text-forest block mb-1">
                        [ RECOMMENDATION ]
                      </span>
                      <p className="font-serif italic text-sm text-charcoal font-semibold leading-relaxed">
                        "{d.recommendation}"
                      </p>
                    </div>

                    {/* Reasoning Steps */}
                    {d.reasoning && d.reasoning.length > 0 && (
                      <div>
                        <span className="text-[9px] uppercase font-black tracking-widest text-charcoal/50 block mb-2">
                          [ REASONING PATH ]
                        </span>
                        <ul className="space-y-1.5 pl-4 list-decimal font-sans text-charcoal/80 leading-relaxed">
                          {d.reasoning.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Side-by-side Trade-offs & Risks */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Trade-offs */}
                      {d.tradeoffs && d.tradeoffs.length > 0 && (
                        <div className="border border-charcoal/10 p-3 bg-alabaster">
                          <span className="text-[9px] uppercase font-black tracking-widest text-forest block mb-2">
                            ✓ Trade-offs
                          </span>
                          <ul className="space-y-1 pl-3.5 list-disc text-charcoal/70 leading-relaxed">
                            {d.tradeoffs.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risks */}
                      {d.risks && d.risks.length > 0 && (
                        <div className="border border-charcoal/10 p-3 bg-alabaster">
                          <span className="text-[9px] uppercase font-black tracking-widest text-terracotta block mb-2">
                            ⚠ Risks
                          </span>
                          <ul className="space-y-1 pl-3.5 list-disc text-charcoal/70 leading-relaxed">
                            {d.risks.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Missing Info & Next Action */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Missing Information */}
                      {d.missing_information && d.missing_information.length > 0 && (
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest text-charcoal/50 block mb-1.5">
                            [ MISSING DETAILS ]
                          </span>
                          <ul className="space-y-1 pl-3.5 list-disc text-charcoal/70 leading-relaxed">
                            {d.missing_information.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Next Steps */}
                      {d.next_step && (
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest text-charcoal/50 block mb-1">
                            [ SUGGESTED ACTION ]
                          </span>
                          <p className="text-charcoal/80 leading-relaxed italic">
                            {d.next_step}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Feedback outcome section */}
                    <div className="border-t border-charcoal/10 pt-4 mt-2 flex justify-between items-center">
                      <span className="text-[9px] uppercase font-bold text-charcoal/40 font-mono">
                        Category: {domain.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase font-bold text-charcoal/50 font-sans mr-1">
                          Was this advice useful?
                        </span>
                        <button
                          onClick={() => handleFeedback(d.id, 'positive')}
                          className={`text-[9px] uppercase font-bold tracking-wider px-2 py-1 border transition-all flex items-center gap-1 ${
                            d.outcome === 'positive'
                              ? 'bg-forest text-alabaster border-forest'
                              : 'text-charcoal/50 border-charcoal/20 hover:border-forest hover:text-forest'
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>Yes</span>
                        </button>
                        <button
                          onClick={() => handleFeedback(d.id, 'negative')}
                          className={`text-[9px] uppercase font-bold tracking-wider px-2 py-1 border transition-all flex items-center gap-1 ${
                            d.outcome === 'negative'
                              ? 'bg-terracotta text-alabaster border-terracotta'
                              : 'text-charcoal/50 border-charcoal/20 hover:border-terracotta hover:text-terracotta'
                          }`}
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span>No</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AI MEMORIES MANAGER ──────────────────────────────────────────────────────
function AIMemoriesManager({ onClose }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers = idToken ? { 'Authorization': `Bearer ${idToken}` } : {};
      const res = await fetch(`${BACKEND}/api/memory`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (err) {
      console.error('Failed to fetch memories:', err);
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleDelete = async (id) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND}/api/memory/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (res.ok) {
        setMemories(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="border-b border-charcoal pb-4 mb-6 flex justify-between items-center">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-1">[ AI PERSONAL MEMORY ]</span>
          <h3 className="text-2xl font-serif font-bold">Orbit AI Memory</h3>
          <p className="text-xs text-charcoal/50 font-sans mt-1">
            Persisted facts and preferences Orbit uses to personalize your recommendations.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold uppercase tracking-wider text-charcoal/50 hover:text-charcoal transition-colors flex items-center gap-1.5 border border-charcoal/20 px-3 py-1.5 hover:border-charcoal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-charcoal/10 bg-alabaster/40 p-4 animate-pulse space-y-2">
              <div className="h-4 bg-charcoal/10 w-3/4 rounded" />
              <div className="h-3 bg-charcoal/10 w-1/2 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="border border-dashed border-charcoal/30 p-12 text-center flex flex-col items-center justify-center bg-alabaster">
          <Brain className="w-8 h-8 text-charcoal/30 mb-3" />
          <p className="font-serif italic text-charcoal/60">AI memory is empty.</p>
          <p className="text-xs text-charcoal/40 mt-2">When analyzing decisions, Orbit will propose facts to remember.</p>
        </div>
      )}

      {!loading && memories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map(m => {
            const domain = DOMAIN_META[m.memoryType] || DOMAIN_META.general;
            return (
              <div key={m.id} className="border border-charcoal/20 bg-alabaster p-5 flex flex-col justify-between hover:border-charcoal transition-colors shadow-[3px_3px_0px_0px_rgba(30,32,30,0.05)]">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${domain.color}`}>
                      {domain.label}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-charcoal/40 font-mono">
                      Importance: {m.importance}
                    </span>
                  </div>
                  <p className="font-serif italic text-sm text-charcoal leading-relaxed">
                    "{m.content}"
                  </p>
                </div>
                <div className="border-t border-charcoal/10 pt-3 mt-4 flex justify-between items-center">
                  <span className="text-[9px] text-charcoal/40 font-sans">
                    Added: {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-[9px] uppercase font-black tracking-widest text-terracotta hover:underline"
                  >
                    Delete Fact
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DecisionEngine({ onNavigateToTab }) {
  const [question, setQuestion] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('advisor'); // 'advisor' | 'history' | 'memory'
  const [proposedMemory, setProposedMemory] = useState(null);
  const resultRef = useRef(null);

  const handleAnalyze = useCallback(async (q = question) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setProposedMemory(null);
    setView('advisor');

    try {
      // Fetch user ID Token securely from Firebase
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Merge additionalContext into question for backend context builder if present
      const finalQuestion = additionalContext.trim() 
        ? `${q.trim()}\n\n[Context: ${additionalContext.trim()}]` 
        : q.trim();

      const res = await fetch(`${BACKEND}/api/decision/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ question: finalQuestion }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `Analysis failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
      if (data.proposed_memory) {
        setProposedMemory(data.proposed_memory);
      }
      // Scroll to result smoothly
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [question, additionalContext, loading]);

  const handleSaveMemory = async () => {
    if (!proposedMemory) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await fetch(`${BACKEND}/api/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          content: proposedMemory.content,
          memory_type: proposedMemory.memory_type,
          importance: proposedMemory.importance,
          source: 'user'
        })
      });

      if (res.ok) {
        setProposedMemory(null);
      }
    } catch (err) {
      console.error('Failed to save memory:', err);
    }
  };


  const handleQuickQuestion = (q) => {
    setQuestion(q);
    handleAnalyze(q);
  };

  const handleReset = () => {
    setQuestion('');
    setAdditionalContext('');
    setResult(null);
    setProposedMemory(null);
    setError('');
    setLoading(false);
    setShowContext(false);
  };

  const handleNavigate = (tab) => {
    if (onNavigateToTab) onNavigateToTab(tab);
  };

  if (view === 'history') {
    return (
      <div>
        <DecisionHistory onClose={() => setView('advisor')} />
      </div>
    );
  }

  if (view === 'memory') {
    return (
      <div>
        <AIMemoriesManager onClose={() => setView('advisor')} />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ── PAGE HEADER ── */}
      <div className="border border-charcoal p-6 md:p-8 bg-alabaster mb-5">
        <div className="flex justify-between items-start mb-1">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-2">[ AI DECISION ENGINE ]</span>
            <h2 className="text-4xl font-serif font-black leading-none tracking-tight">Think Before You Decide.</h2>
            <p className="text-sm text-charcoal/60 font-sans mt-2 max-w-lg leading-relaxed">
              Your personal AI advisor — pulls live data from Health, Finance, Calendar &amp; Documents to give you personalized, explainable recommendations.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setView('history')}
              className="text-xs font-bold uppercase tracking-wider text-charcoal/50 border border-charcoal/20 px-3 py-2 hover:border-charcoal hover:text-charcoal transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
            <button
              onClick={() => setView('memory')}
              className="text-xs font-bold uppercase tracking-wider text-charcoal/50 border border-charcoal/20 px-3 py-2 hover:border-charcoal hover:text-charcoal transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Memories</span>
            </button>
          </div>
        </div>

        {/* Quick-tap domain pills */}
        <div className="mt-5 flex gap-2 flex-wrap">
          {Object.entries(DOMAIN_META).filter(([k]) => k !== 'general').map(([key, meta]) => (
            <span key={key} className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 border ${meta.color} bg-alabaster flex items-center gap-1.5`}>
              {React.createElement(meta.icon, { className: "w-3.5 h-3.5 stroke-[2px]" })}
              <span>{meta.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── PROPOSED MEMORY CONFIRMATION PANEL ── */}
      {proposedMemory && (
        <div className="border border-forest p-5 bg-forest/5 mb-5 animate-fadeIn flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-dashed shadow-[3px_3px_0px_0px_rgba(68,107,79,0.1)]">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-forest block mb-1">
              [ AI MEMORY DETECTED ]
            </span>
            <p className="text-sm font-sans text-charcoal leading-relaxed">
              Should Orbit remember this fact: <strong className="font-serif italic font-semibold text-forest">"{proposedMemory.content}"</strong>?
            </p>
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={handleSaveMemory}
              className="text-xs uppercase font-bold tracking-wider bg-forest text-alabaster px-4 py-2 border border-forest hover:bg-forest/90 transition-colors shadow-[2px_2px_0px_0px_rgba(30,32,30,0.1)]"
            >
              Remember
            </button>
            <button
              onClick={() => setProposedMemory(null)}
              className="text-xs uppercase font-bold tracking-wider text-charcoal/50 border border-charcoal/20 px-4 py-2 hover:border-charcoal hover:text-charcoal transition-colors bg-alabaster"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* ── QUESTION INPUT ── */}
      <div className="border border-charcoal p-5 md:p-7 bg-alabaster mb-5">
        <label className="block text-xs uppercase font-bold tracking-wider text-charcoal/60 mb-3">
          [ YOUR DECISION ]
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnalyze();
          }}
          rows={3}
          placeholder={`e.g. "Can I afford a vacation next month?" · "Should I skip today's workout?" · "Should I accept this job offer?"`}
          className="w-full bg-alabaster border border-charcoal/40 p-3 font-serif text-base text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-charcoal resize-none"
          disabled={loading}
        />

        {/* Optional context */}
        <div className="mt-3">
          <button
            onClick={() => setShowContext(v => !v)}
            className="text-[10px] uppercase font-bold tracking-wider text-charcoal/40 hover:text-charcoal transition-colors"
          >
            {showContext ? '▲ Hide' : '▼ Add'} Additional Context (optional)
          </button>
          {showContext && (
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={2}
              placeholder='e.g. "I have 6 months of runway savings. Growth matters more than stability right now."'
              className="w-full mt-2 bg-alabaster border border-charcoal/30 p-3 font-sans text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-charcoal resize-none"
              disabled={loading}
            />
          )}
        </div>

        {/* CTA Row */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => handleAnalyze()}
            disabled={loading || !question.trim()}
            className="bg-charcoal text-alabaster font-sans px-7 py-2.5 uppercase text-xs font-black tracking-widest hover:bg-forest transition-colors border border-charcoal shadow-[3px_3px_0px_0px_rgba(30,32,30,1)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? 'Analyzing...' : 'Analyze Decision'}
          </button>
          {(question || result || error) && !loading && (
            <button
              onClick={handleReset}
              className="text-xs uppercase font-bold tracking-wider text-charcoal/40 hover:text-charcoal transition-colors"
            >
              ✕ Reset
            </button>
          )}
          <span className="hidden md:block text-[10px] text-charcoal/30 font-sans">
            ⌘ Enter to analyze
          </span>
        </div>
      </div>

      {/* ── QUICK EXAMPLE QUESTIONS ── */}
      {!loading && !result && !error && (
        <div className="mb-5">
          <div className="text-xs uppercase font-bold tracking-wider text-charcoal/40 mb-3">Try an example</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXAMPLE_QUESTIONS.map(({ q, domain }) => {
              const meta = DOMAIN_META[domain] || DOMAIN_META.general;
              return (
                <button
                  key={q}
                  onClick={() => handleQuickQuestion(q)}
                  className="text-left px-4 py-3 border border-charcoal/20 hover:border-charcoal bg-alabaster transition-all group flex items-start gap-2 hover:-translate-y-0.5"
                >
                  <span className="text-sm font-sans text-charcoal/70 group-hover:text-charcoal transition-colors flex items-center gap-1.5">
                    {React.createElement(meta.icon, { className: "w-3.5 h-3.5 stroke-[2px] shrink-0 mt-0.5" })}
                    <span>{q}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── THINKING PIPELINE ── */}
      {loading && (
        <div className="mb-5">
          <ThinkingPipeline active={loading} />
        </div>
      )}

      {/* ── ERROR STATE ── */}
      {error && !loading && (
        <div className="mb-5 border border-terracotta p-5 bg-terracotta/5">
          <div className="text-xs uppercase font-bold tracking-wider text-terracotta mb-1">[ ANALYSIS FAILED ]</div>
          <p className="text-sm font-sans text-terracotta">{error}</p>
        </div>
      )}

      {/* ── RECOMMENDATION RESULT ── */}
      {result && !loading && (
        <div ref={resultRef} className="border border-charcoal p-5 md:p-7 bg-alabaster">
          <div className="border-b border-charcoal/20 pb-4 mb-5 flex justify-between items-center">
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50">[ DECISION ANALYSIS COMPLETE ]</span>
            <button
              onClick={handleReset}
              className="text-[10px] uppercase font-bold tracking-wider text-charcoal/40 hover:text-charcoal transition-colors border border-charcoal/20 px-2 py-1 hover:border-charcoal"
            >
              New Question
            </button>
          </div>
          <DecisionResult
            result={result}
            onNavigate={handleNavigate}
            onFeedback={() => {}}
          />
        </div>
      )}

      {/* ── HOW IT WORKS FOOTER ── */}
      {!result && !loading && (
        <div className="border border-dashed border-charcoal/20 p-5 bg-alabaster">
          <div className="text-xs uppercase font-bold tracking-wider text-charcoal/40 mb-3">[ HOW Orbit DECIDES ]</div>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: '🔍', step: 'Understand', desc: 'Classify question & gather relevant live data from all modules' },
              { icon: '⚖️', step: 'Analyze', desc: 'Cross-domain reasoning. No generic advice — uses your actual numbers' },
              { icon: '✨', step: 'Recommend', desc: 'Clear recommendation + scenario comparison + next steps' },
            ].map(s => (
              <div key={s.step}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1">{s.step}</div>
                <div className="text-[10px] text-charcoal/50 font-sans leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
