import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  AlertCircle
} from 'lucide-react';

const BACKEND = 'http://localhost:5001';

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
  const c = confidenceColor(confidence);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-charcoal/10 relative overflow-hidden">
        <div
          className={`h-full ${c.bar} transition-all duration-700`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 border ${c.text} ${c.border}`}>
        {c.label} — {confidence}%
      </span>
    </div>
  );
}

// ─── SCENARIO CARD ────────────────────────────────────────────────────────────
function ScenarioCard({ scenario, isRecommended, color }) {
  if (!scenario) return null;
  return (
    <div className={`border p-5 bg-alabaster relative ${isRecommended ? 'border-forest shadow-[3px_3px_0px_0px_rgba(68,107,79,0.3)]' : 'border-charcoal/30'}`}>
      {isRecommended && (
        <span className="absolute -top-2.5 left-4 bg-forest text-alabaster text-[9px] uppercase font-bold tracking-wider px-2 py-0.5">
          EVA Recommends
        </span>
      )}
      <div className="text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-2">[ {scenario.label?.toUpperCase()} ]</div>
      <p className="font-serif italic text-sm text-charcoal leading-relaxed mb-4">
        "{scenario.outcome}"
      </p>
      <ul className="space-y-1.5">
        {(scenario.impact || []).map((item, i) => {
          const type = impactIcon(item);
          return (
            <li key={i} className={`text-xs font-sans flex items-start gap-2 ${
              type === 'positive' ? 'text-forest' :
              type === 'negative' ? 'text-terracotta' :
              'text-charcoal/60'
            }`}>
              <span className="shrink-0 font-bold">{item.charAt(0)}</span>
              <span>{item.slice(1).trim()}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── RECOMMENDATION RESULT ────────────────────────────────────────────────────
function DecisionResult({ result, onNavigate, onFeedback }) {
  const [showReasoning, setShowReasoning] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const domain = DOMAIN_META[result.domain] || DOMAIN_META.general;

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

  const handleNextAction = (action) => {
    const tab = NAV_ACTION_MAP[action];
    if (tab && onNavigate) onNavigate(tab);
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
        {result.dataUsed?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {result.dataUsed.map(src => {
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
      <div className="border border-charcoal p-6 bg-alabaster shadow-[4px_4px_0px_0px_rgba(30,32,30,0.12)]">
        <span className="text-xs uppercase font-bold tracking-wider text-forest block mb-3">[ RECOMMENDATION ]</span>
        <p className="font-serif text-xl leading-snug text-charcoal font-semibold mb-5">
          "{result.recommendation}"
        </p>
        <ConfidenceMeter confidence={result.confidence || 0} />
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
          <div className="px-5 pb-5 border-t border-charcoal/10">
            <ul className="space-y-3 mt-4">
              {(result.reasoning || []).map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-sans text-charcoal/80">
                  <span className="w-5 h-5 flex items-center justify-center bg-charcoal text-alabaster text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Scenario Comparison — The WOW Feature */}
      {result.scenarioA && result.scenarioB && (
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-charcoal/50 mb-3">[ WHAT IF? ] Scenario Comparison</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScenarioCard scenario={result.scenarioA} isRecommended={false} />
            <ScenarioCard scenario={result.scenarioB} isRecommended={true} />
          </div>
        </div>
      )}

      {/* Next Actions */}
      {result.nextActions?.length > 0 && (
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-charcoal/50 mb-3">[ EXECUTE ] Next Steps</div>
          <div className="flex gap-2 flex-wrap">
            {result.nextActions.map(action => (
              <button
                key={action}
                onClick={() => handleNextAction(action)}
                className="text-xs font-bold uppercase tracking-wider px-4 py-2 border border-charcoal text-charcoal hover:bg-charcoal hover:text-alabaster transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{action}</span>
              </button>
            ))}
          </div>
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
              <span>Thank you — EVA will improve.</span>
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

  useEffect(() => {
    fetch(`${BACKEND}/decision/history`)
      .then(r => r.json())
      .then(d => setDecisions(d.decisions || []))
      .catch(() => setDecisions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="border-b border-charcoal pb-4 mb-6 flex justify-between items-center">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-1">[ DECISION LOG ]</span>
          <h3 className="text-2xl font-serif font-bold">Past Decisions</h3>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold uppercase tracking-wider text-charcoal/50 hover:text-charcoal transition-colors flex items-center gap-1.5"
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

      {!loading && decisions.length === 0 && (
        <div className="border border-dashed border-charcoal/30 p-12 text-center flex flex-col items-center justify-center">
          <History className="w-8 h-8 text-charcoal/30 mb-3" />
          <p className="font-serif italic text-charcoal/60">No decisions made yet.</p>
          <p className="text-xs text-charcoal/40 mt-2">Your analyzed decisions will appear here.</p>
        </div>
      )}

      {!loading && decisions.length > 0 && (
        <div className="space-y-2">
          {decisions.map(d => {
            const domain = DOMAIN_META[d.domain] || DOMAIN_META.general;
            const conf = confidenceColor(d.confidence || 0);
            const isExpanded = expanded === d.id;
            return (
              <div key={d.id} className="border border-charcoal/20 bg-alabaster hover:border-charcoal transition-colors hover:bg-charcoal/[0.01]">
                <button
                  onClick={() => setExpanded(isExpanded ? null : d.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  {React.createElement(domain.icon, { className: "w-4.5 h-4.5 text-charcoal/60 shrink-0 mt-0.5" })}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-serif font-semibold text-charcoal truncate">{d.question}</div>
                    <div className="text-xs text-charcoal/50 mt-0.5 font-sans">{formatRelativeTime(d.timestamp)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${conf.text} ${conf.border}`}>
                      {d.confidence}%
                    </span>
                    {d.outcome && (
                      <span className={`text-[10px] ${d.outcome === 'positive' ? 'text-forest' : 'text-terracotta'}`}>
                        {d.outcome === 'positive' ? <ThumbsUp className="w-3.5 h-3.5 inline" /> : <ThumbsDown className="w-3.5 h-3.5 inline" />}
                      </span>
                    )}
                    <span className="text-charcoal/30 text-sm">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-charcoal/10 pt-3">
                    <p className="font-serif italic text-sm text-charcoal/80 leading-relaxed">
                      "{d.recommendation}"
                    </p>
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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DecisionEngine({ onNavigateToTab }) {
  const [question, setQuestion] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('advisor'); // 'advisor' | 'history'
  const resultRef = useRef(null);

  const handleAnalyze = useCallback(async (q = question) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setView('advisor');

    try {
      const res = await fetch(`${BACKEND}/decision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, additionalContext }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
      // Scroll to result smoothly
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [question, additionalContext, loading]);

  const handleQuickQuestion = (q) => {
    setQuestion(q);
    handleAnalyze(q);
  };

  const handleReset = () => {
    setQuestion('');
    setAdditionalContext('');
    setResult(null);
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
          <button
            onClick={() => setView('history')}
            className="text-xs font-bold uppercase tracking-wider text-charcoal/50 border border-charcoal/20 px-3 py-2 hover:border-charcoal hover:text-charcoal transition-all shrink-0 flex items-center gap-1.5 hover:-translate-y-0.5"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
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
          <div className="text-xs uppercase font-bold tracking-wider text-charcoal/40 mb-3">[ HOW EVA DECIDES ]</div>
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
