import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GraduationCap, 
  Coins, 
  Heart, 
  Rocket, 
  Target, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Award, 
  Flame, 
  LayoutDashboard, 
  ClipboardList, 
  CheckSquare, 
  BrainCircuit, 
  Calendar, 
  Check, 
  ChevronRight, 
  Lock, 
  Lightbulb, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  ArrowLeft
} from 'lucide-react';

const BACKEND = 'http://localhost:5001';

const HEALTH_STATUS = {
  on_track:  { label: 'On Track',   icon: CheckCircle2, color: 'text-forest border-forest bg-forest/5' },
  at_risk:   { label: 'At Risk',    icon: AlertTriangle, color: 'text-amber-600 border-amber-500 bg-amber-500/5' },
  behind:    { label: 'Behind',     icon: AlertCircle,  color: 'text-terracotta border-terracotta bg-terracotta/5' },
  completed: { label: 'Completed',  icon: Award,        color: 'text-blue-600 border-blue-500 bg-blue-500/5' }
};

const QUICK_GOALS = [
  'I want to become a full-stack developer in 6 months',
  'I want to save ₹1 lakh by December',
  'I want to lose 5 kg before my birthday',
  'I want to prepare for my interviews in 3 months',
  'I want to build my own app and launch it'
];

// Helper: Custom Goal Icon Resolver
function GoalIcon({ icon, className = "w-5 h-5 text-charcoal/70" }) {
  const map = {
    '🎓': GraduationCap,
    '💻': Rocket,
    '❤️': Heart,
    '💰': Coins,
    '🎯': Target,
    'Learning': GraduationCap,
    'Finance': Coins,
    'Health': Heart,
    'Project': Rocket,
    'Personal': Target
  };
  const IconComponent = map[icon] || Target;
  return <IconComponent className={className} />;
}

function AnimatedProgressBar({ value, max = 100, color = 'bg-charcoal', animated = true }) {
  const [width, setWidth] = useState(0);
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="w-full h-1.5 bg-charcoal/10 border border-charcoal/10 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-700 ease-out rounded-full`}
        style={{ width: animated ? `${width}%` : `${pct}%` }}
      />
    </div>
  );
}

function HabitCheckbox({ habit, onLog, selectedDate }) {
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(habit.completedToday);

  useEffect(() => {
    setDone(habit.completedToday);
  }, [habit.completedToday]);

  const handleCheck = async () => {
    if (checking) return;
    const newVal = !done;
    setChecking(true);
    setDone(newVal);
    try {
      await fetch(`${BACKEND}/habits/${habit.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newVal, value: habit.targetValue, date: selectedDate })
      });
      if (onLog) onLog(habit.id, newVal);
    } catch {
      setDone(!newVal); // revert on error
    } finally {
      setChecking(false);
    }
  };

  return (
    <button
      onClick={handleCheck}
      disabled={checking}
      className={`flex items-center gap-3 w-full text-left p-3.5 border transition-all duration-200 group active:scale-[0.99] ${
        done
          ? 'border-forest/30 bg-forest/[0.03]'
          : 'border-charcoal/15 bg-alabaster hover:border-charcoal/40 hover:bg-charcoal/[0.01]'
      }`}
    >
      <div className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 transition-all duration-300 rounded ${
        done ? 'bg-forest border-forest scale-105' : 'border-charcoal/40 group-hover:border-charcoal'
      }`} style={done ? { animation: 'scalePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' } : {}}>
        {done && <Check className="w-3 h-3 text-alabaster stroke-[3px]" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-sans font-semibold block truncate transition-all duration-200 ${
          done ? 'line-through text-charcoal/40' : 'text-charcoal'
        }`}>{habit.title}</span>
        <span className="text-[10px] uppercase tracking-wider font-bold text-charcoal/40 flex items-center gap-1.5 mt-0.5">
          <GoalIcon icon={habit.goalIcon} className="w-3 h-3 text-charcoal/40" />
          <span>{habit.goalTitle || ''} · {habit.frequency}</span>
        </span>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-xs font-bold text-charcoal/50">{habit.completionRate}%</span>
        {habit.currentStreak > 0 && (
          <span className="text-[10px] flex items-center justify-end text-amber-500 font-bold mt-0.5">
            <Flame className="w-3.5 h-3.5 mr-0.5 fill-current" />
            <span>{habit.currentStreak}d</span>
          </span>
        )}
      </div>
    </button>
  );
}

function MilestoneTimeline({ milestones, onComplete }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-charcoal/15" />
      <div className="space-y-0">
        {milestones.sort((a, b) => a.order - b.order).map((ms, idx) => {
          const isCompleted = ms.status === 'completed';
          const isActive = ms.status === 'active';
          const isLocked = ms.status === 'locked';
          return (
            <div key={ms.id} className={`relative pl-10 pb-6 ${idx === milestones.length - 1 ? 'pb-0' : ''} animate-fadeIn`} style={{ animationDelay: `${idx * 0.05}s` }}>
              {/* Node */}
              <div className={`absolute left-2 top-0.5 w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all duration-300 ${
                isCompleted ? 'bg-forest border-forest' :
                isActive ? 'bg-charcoal border-charcoal scale-105 shadow-sm' :
                'bg-alabaster border-charcoal/30'
              }`}>
                {isCompleted && <Check className="w-2.5 h-2.5 text-alabaster stroke-[3px]" />}
                {isActive && <ChevronRight className="w-3 h-3 text-alabaster animate-pulse" />}
                {isLocked && <Lock className="w-2.5 h-2.5 text-charcoal/40" />}
              </div>

              {/* Content */}
              <div className={`border p-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
                isCompleted ? 'border-forest/20 bg-forest/[0.02]' :
                isActive ? 'border-charcoal bg-alabaster shadow-[3px_3px_0px_0px_rgba(30,32,30,0.06)]' :
                'border-charcoal/10 bg-alabaster/40 opacity-60'
              }`}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                      isCompleted ? 'text-forest' : isActive ? 'text-charcoal' : 'text-charcoal/40'
                    }`}>
                      Phase {ms.order}
                    </span>
                    <p className="text-sm font-serif font-bold text-charcoal">{ms.title}</p>
                    {ms.description && <p className="text-xs text-charcoal/50 font-sans mt-1 leading-relaxed">{ms.description}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] text-charcoal/40 font-sans block font-semibold">
                      Due: {ms.dueDate ? new Date(ms.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    {isActive && onComplete && (
                      <button
                        onClick={() => onComplete(ms.id)}
                        className="mt-2.5 text-[9px] font-bold uppercase tracking-wider border border-forest text-forest px-2.5 py-1 hover:bg-forest hover:text-alabaster transition-all duration-200"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalEngineSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Greeting Skeleton */}
      <div className="border-b border-charcoal/10 pb-4 space-y-2">
        <div className="h-7 w-2/3 bg-charcoal/10 rounded" />
        <div className="h-4 w-1/2 bg-charcoal/5 rounded" />
      </div>

      {/* Grid of Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="border border-charcoal/10 p-5 bg-alabaster/50 space-y-4">
            <div className="flex justify-between items-center">
              <div className="w-8 h-8 rounded-full bg-charcoal/10" />
              <div className="w-16 h-5 bg-charcoal/10 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-4/5 bg-charcoal/15 rounded" />
              <div className="h-3 w-1/3 bg-charcoal/10 rounded" />
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="h-3 w-full bg-charcoal/5 rounded" />
              <div className="h-2 w-full bg-charcoal/10 rounded-full" />
            </div>
            <div className="h-4 w-1/2 bg-charcoal/5 rounded pt-1" />
          </div>
        ))}
      </div>

      {/* Habit Section Skeleton */}
      <div className="border border-charcoal/15 p-4 bg-alabaster/40 space-y-3">
        <div className="h-4 w-28 bg-charcoal/15 rounded" />
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 w-full bg-charcoal/5 border border-charcoal/10 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GoalEngine({ onNavigateToTab, selectedDate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [goals, setGoals] = useState([]);
  const [todayHabits, setTodayHabits] = useState([]);
  const [habitSummary, setHabitSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Goal creator state
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [goalInsights, setGoalInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Creator panel
  const [creatorText, setCreatorText] = useState('');
  const [creating, setCreating] = useState(false);
  const [creationPreview, setCreationPreview] = useState(null);
  const [creatorStep, setCreatorStep] = useState(0);
  const creatorIntervalRef = useRef(null);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/goals?date=${selectedDate}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGoals(data.goals || []);
    } catch { /* non-fatal */ }
  }, [selectedDate]);

  const fetchTodayHabits = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/habits/today?date=${selectedDate}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTodayHabits(data.habits || []);
      setHabitSummary(data.summary || null);
    } catch { /* non-fatal */ }
  }, [selectedDate]);

  const fetchInsights = useCallback(async (goalId) => {
    setInsightsLoading(true);
    try {
      const res = await fetch(`${BACKEND}/goals/${goalId}/insights`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGoalInsights(data.insights || []);
    } catch { /* non-fatal */ }
    finally { setInsightsLoading(false); }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchGoals(), fetchTodayHabits()]);
      setLoading(false);
    };
    init();
  }, [fetchGoals, fetchTodayHabits]);

  useEffect(() => {
    if (selectedGoal) {
      fetchInsights(selectedGoal.id);
    }
  }, [selectedGoal, fetchInsights]);

  const handleCreateGoal = async () => {
    if (!creatorText.trim()) return;
    setCreating(true);
    setCreationPreview(null);
    setCreatorStep(0);

    // Simulate multi-step analysis
    creatorIntervalRef.current = setInterval(() => {
      setCreatorStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 700);

    try {
      const res = await fetch(`${BACKEND}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: creatorText })
      });
      if (!res.ok) throw new Error('Failed to create goal.');
      const data = await res.json();

      setTimeout(() => {
        clearInterval(creatorIntervalRef.current);
        setCreationPreview(data);
        setCreating(false);
      }, 3200);
    } catch (err) {
      clearInterval(creatorIntervalRef.current);
      setError(err.message);
      setCreating(false);
    }
  };

  const handleConfirmGoal = async () => {
    setCreationPreview(null);
    setCreatorText('');
    setCreatorStep(0);
    await fetchGoals();
    setActiveTab('overview');
  };

  const handleCompleteMilestone = async (milestoneId) => {
    try {
      await fetch(`${BACKEND}/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      await fetchGoals();
      if (selectedGoal) {
        const updated = (await (await fetch(`${BACKEND}/goals`)).json()).goals.find(g => g.id === selectedGoal.id);
        if (updated) setSelectedGoal(updated);
      }
    } catch { /* non-fatal */ }
  };

  const handleReplan = async (goalId, strategy) => {
    try {
      const res = await fetch(`${BACKEND}/goals/${goalId}/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await fetchGoals();
      if (selectedGoal?.id === goalId) setSelectedGoal(data.goal);
    } catch { /* non-fatal */ }
  };

  const handleHabitLog = useCallback(() => {
    fetchTodayHabits();
  }, [fetchTodayHabits]);

  const completedToday = todayHabits.filter(h => h.completedToday).length;
  const totalHabits = todayHabits.length;
  const habitPct = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── STYLES & ANIMATIONS ── */}
      <style>{`
        @keyframes scalePop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ── MODULE HEADER ── */}
      <div className="border border-charcoal p-6 md:p-8 bg-alabaster flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-2">[ STRATEGIC INTELLIGENCE MODULE ]</span>
          <h2 className="text-4xl font-serif font-black leading-none tracking-tight">Goal Engine</h2>
          <p className="text-sm text-charcoal/60 font-sans mt-2 max-w-lg leading-relaxed">
            Turn your ambitions into a system. EVA builds your plan, tracks your habits, detects drift, and adapts to real life.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <div className="border border-charcoal bg-alabaster p-4 text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-1">Today's Habits</span>
            <span className={`text-2xl font-serif font-bold ${habitPct >= 70 ? 'text-forest' : habitPct >= 40 ? 'text-amber-600' : 'text-terracotta'}`}>
              {completedToday} / {totalHabits}
            </span>
            <span className="text-[9px] text-charcoal/40 block font-sans">{habitPct}% done</span>
          </div>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="border border-charcoal bg-alabaster p-1 flex gap-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
          { id: 'goals', label: 'Goals', icon: Target },
          { id: 'habits', label: 'Habit Tracker', icon: CheckSquare },
          { id: 'insights', label: 'Intelligence', icon: BrainCircuit },
          { id: 'today', label: 'Today\'s Plan', icon: Calendar }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-sans border transition-all duration-200 shrink-0 flex items-center gap-2 ${
                activeTab === t.id
                  ? 'bg-charcoal text-alabaster border-charcoal'
                  : 'border-transparent text-charcoal/60 hover:text-charcoal hover:-translate-y-0.5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── MODULE BODY ── */}
      <div className="border border-charcoal p-5 md:p-7 bg-alabaster min-h-[400px]">
        {loading && <GoalEngineSkeleton />}

        {/* ── TAB: COMMAND CENTER ── */}
        {!loading && activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Greeting */}
            <div className="border-b border-charcoal/10 pb-4">
              <h3 className="text-2xl font-serif font-bold">
                {goals.length > 0
                  ? `Your ${goals.length} active goal${goals.length > 1 ? 's' : ''} ${goals.every(g => g.healthStatus === 'on_track') ? 'are all on track.' : 'need attention.'}`
                  : 'No goals yet. Start by setting your first ambition.'}
              </h3>
              {todayHabits.length > 0 && (
                <p className="text-sm text-charcoal/60 font-sans mt-1">
                  You have completed <strong>{completedToday}</strong> of <strong>{totalHabits}</strong> habits today.
                  {habitPct >= 70 ? ' Excellent consistency.' : habitPct >= 40 ? ' Keep going.' : ' Let\'s get started.'}
                </p>
              )}
            </div>

            {/* Goals grid */}
            {goals.length === 0 ? (
              <div className="border-2 border-dashed border-charcoal/20 p-12 text-center">
                <p className="font-serif italic text-charcoal/40 text-lg">No active goals found.</p>
                <button
                  onClick={() => setActiveTab('goals')}
                  className="mt-4 bg-charcoal text-alabaster font-sans px-6 py-2 uppercase text-xs font-black tracking-widest hover:bg-forest transition-colors border border-charcoal hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Create Your First Goal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {goals.map((goal, idx) => {
                  const status = HEALTH_STATUS[goal.healthStatus] || HEALTH_STATUS.on_track;
                  const StatusIcon = status.icon;
                  const progressPct = goal.unit === '%'
                    ? goal.currentValue
                    : Math.round((goal.currentValue / goal.targetValue) * 100);
                  return (
                    <button
                      key={goal.id}
                      onClick={() => { setSelectedGoal(goal); setActiveTab('goals'); }}
                      className="text-left border border-charcoal p-5 bg-alabaster hover:border-forest hover:-translate-y-1 transition-all duration-300 group flex flex-col gap-3.5 shadow-[2px_2px_0px_0px_rgba(30,32,30,0.06)] hover:shadow-[4px_4px_0px_0px_rgba(30,32,30,0.1)] animate-fadeIn"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="p-2 border border-charcoal/10 bg-alabaster rounded group-hover:border-forest/30 transition-colors">
                          <GoalIcon icon={goal.icon} className="w-5 h-5 text-charcoal/80" />
                        </div>
                        <span className={`text-[9px] uppercase font-bold tracking-wider border px-1.5 py-0.5 flex items-center gap-1 ${status.color}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          <span>{status.label}</span>
                        </span>
                      </div>

                      <div>
                        <h4 className="font-serif font-bold text-lg leading-tight group-hover:text-forest transition-colors">
                          {goal.title}
                        </h4>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-charcoal/40 block mt-1">{goal.category}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50">Progress</span>
                          <span className="text-xs font-serif font-black">
                            {goal.unit === '₹'
                              ? `₹${(goal.currentValue / 1000).toFixed(0)}k / ₹${(goal.targetValue / 1000).toFixed(0)}k`
                              : `${progressPct}%`
                            }
                          </span>
                        </div>
                        <AnimatedProgressBar
                          value={progressPct}
                          color={goal.healthStatus === 'behind' ? 'bg-terracotta' : goal.healthStatus === 'at_risk' ? 'bg-amber-500' : 'bg-forest'}
                        />
                      </div>

                      {/* Success probability */}
                      <div className="flex justify-between items-center pt-2.5 border-t border-charcoal/8 text-[10px] text-charcoal/50">
                        <span className="truncate max-w-[70%]">
                          Next: <span className="font-semibold text-charcoal/70">{goal.nextAction}</span>
                        </span>
                        <span className="font-bold text-charcoal/70 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-forest" />
                          {goal.successProbability}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick habit overview */}
            {todayHabits.length > 0 && (
              <div className="border border-charcoal/15 p-5 bg-alabaster">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    <span>Today's Habits</span>
                  </span>
                  <button onClick={() => setActiveTab('habits')} className="text-[10px] uppercase font-bold text-forest hover:underline">View All →</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {todayHabits.slice(0, 4).map(h => (
                    <HabitCheckbox key={h.id} habit={h} onLog={handleHabitLog} selectedDate={selectedDate} />
                  ))}
                </div>
                {todayHabits.length > 4 && (
                  <button onClick={() => setActiveTab('habits')} className="text-xs text-charcoal/40 font-sans w-full text-center py-2 hover:text-charcoal transition-colors mt-2">
                    +{todayHabits.length - 4} more habits
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: GOALS (Create / Detail) ── */}
        {!loading && activeTab === 'goals' && (
          <div className="space-y-6 animate-fadeIn">
            {selectedGoal ? (
              /* GOAL DETAIL VIEW */
              <div className="space-y-6">
                <button
                  onClick={() => { setSelectedGoal(null); setGoalInsights([]); }}
                  className="text-xs uppercase font-bold tracking-wider text-charcoal/50 hover:text-charcoal flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to All Goals</span>
                </button>

                {/* Goal Header */}
                <div className="border border-charcoal p-6 md:p-8 bg-alabaster shadow-sm">
                  {(() => {
                    const status = HEALTH_STATUS[selectedGoal.healthStatus] || HEALTH_STATUS.on_track;
                    const StatusIcon = status.icon;
                    const progressPct = selectedGoal.unit === '%'
                      ? selectedGoal.currentValue
                      : Math.round((selectedGoal.currentValue / selectedGoal.targetValue) * 100);
                    return (
                      <>
                        <div className="flex justify-between items-start mb-5">
                          <div className="flex items-center gap-3">
                            <div className="p-3 border border-charcoal/10 bg-alabaster rounded">
                              <GoalIcon icon={selectedGoal.icon} className="w-6 h-6 text-charcoal/80" />
                            </div>
                            <span className={`text-[10px] uppercase font-bold tracking-wider border px-1.5 py-0.5 flex items-center gap-1 ${status.color}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              <span>{status.label}</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-serif font-black">{selectedGoal.successProbability}%</div>
                            <span className="text-[9px] text-charcoal/40 uppercase tracking-wider font-bold">Success Probability</span>
                          </div>
                        </div>
                        <h3 className="text-3xl font-serif font-bold mb-2 text-charcoal">{selectedGoal.title}</h3>
                        <p className="text-sm text-charcoal/60 font-sans mb-6 leading-relaxed">{selectedGoal.description}</p>

                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-charcoal/60 uppercase tracking-wider">Progress</span>
                          <span className="text-sm font-serif font-black">
                            {selectedGoal.unit === '₹'
                              ? `₹${selectedGoal.currentValue.toLocaleString('en-IN')} / ₹${selectedGoal.targetValue.toLocaleString('en-IN')}`
                              : `${progressPct}% complete`}
                          </span>
                        </div>
                        <AnimatedProgressBar
                          value={progressPct}
                          color={selectedGoal.healthStatus === 'behind' ? 'bg-terracotta' : selectedGoal.healthStatus === 'at_risk' ? 'bg-amber-500' : 'bg-forest'}
                        />

                        <div className="grid grid-cols-3 gap-4 mt-6 text-center text-xs">
                          <div className="border border-charcoal/10 p-3 bg-alabaster/40">
                            <span className="font-bold block text-base flex items-center justify-center gap-1">
                              <Clock className="w-4 h-4 text-charcoal/50" />
                              {selectedGoal.remainingDays || '—'}
                            </span>
                            <span className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40 mt-1 block">Days Left</span>
                          </div>
                          <div className="border border-charcoal/10 p-3 bg-alabaster/40">
                            <span className="font-bold block text-base">{selectedGoal.expectedProgress || 0}%</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40 mt-1 block">Expected</span>
                          </div>
                          <div className="border border-charcoal/10 p-3 bg-alabaster/40">
                            <span className={`font-bold block text-base ${selectedGoal.driftGap > 8 ? 'text-terracotta' : 'text-forest'}`}>
                              {selectedGoal.driftGap > 0 ? '-' : '+'}{Math.abs(selectedGoal.driftGap || 0)}%
                            </span>
                            <span className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40 mt-1 block">Drift</span>
                          </div>
                        </div>

                        {/* Prediction alert */}
                        {selectedGoal.predictedCompletionDate && selectedGoal.predictedCompletionDate !== selectedGoal.targetDate && (
                          <div className="mt-5 border border-amber-500/20 bg-amber-500/[0.02] p-4 flex gap-3">
                            <BrainCircuit className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-sans text-amber-800 leading-relaxed">
                              <strong>EVA Forecast:</strong> At your current pace, completion is estimated for{' '}
                              <strong>{new Date(selectedGoal.predictedCompletionDate).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                              {' '}— vs your target of{' '}
                              <strong>{new Date(selectedGoal.targetDate).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
                            </p>
                          </div>
                        )}

                        {/* Replan options */}
                        {selectedGoal.healthStatus !== 'on_track' && selectedGoal.healthStatus !== 'completed' && (
                          <div className="mt-6 border-t border-charcoal/10 pt-5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ ADAPTIVE REPLAN ]</span>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => handleReplan(selectedGoal.id, 'extend')}
                                className="text-xs font-bold uppercase tracking-wider border border-charcoal/30 px-3 py-2 hover:bg-charcoal hover:text-alabaster transition-all duration-200"
                              >
                                Extend Deadline +30d
                              </button>
                              <button
                                onClick={() => handleReplan(selectedGoal.id, 'redistribute')}
                                className="text-xs font-bold uppercase tracking-wider border border-charcoal/30 px-3 py-2 hover:bg-charcoal hover:text-alabaster transition-all duration-200"
                              >
                                Redistribute Milestones
                              </button>
                              <button
                                onClick={() => handleReplan(selectedGoal.id, 'compress')}
                                className="text-xs font-bold uppercase tracking-wider border border-forest text-forest px-3 py-2 hover:bg-forest hover:text-alabaster transition-all duration-200"
                              >
                                Increase Daily Target
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Milestone Timeline */}
                {selectedGoal.milestones?.length > 0 && (
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block">[ MILESTONE TIMELINE ]</span>
                    <MilestoneTimeline
                      milestones={selectedGoal.milestones}
                      onComplete={handleCompleteMilestone}
                    />
                  </div>
                )}

                {/* Habits for this goal */}
                {selectedGoal.habits?.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block">[ SUPPORTING HABITS ]</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedGoal.habits.map(h => (
                        <div key={h.id} className="border border-charcoal/15 p-4 flex justify-between items-center bg-alabaster">
                          <div>
                            <p className="text-sm font-sans font-semibold text-charcoal">{h.title}</p>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-charcoal/40 block mt-0.5">{h.frequency}</span>
                          </div>
                          <div className="flex gap-4 text-center text-xs">
                            <div>
                              <span className="font-bold block text-charcoal">{h.completionRate}%</span>
                              <span className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40 block mt-0.5">rate</span>
                            </div>
                            {h.currentStreak > 0 && (
                              <div>
                                <span className="font-bold block text-amber-500 flex items-center gap-0.5">
                                  <Flame className="w-3.5 h-3.5 fill-current" />
                                  {h.currentStreak}
                                </span>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40 block mt-0.5">streak</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* GOAL LIST + CREATOR */
              <div className="space-y-6">
                {/* Goal creator */}
                <div className="border border-charcoal p-5 bg-alabaster">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ AI GOAL CREATOR ]</span>

                  {!creating && !creationPreview && (
                    <div className="space-y-3">
                      <textarea
                        value={creatorText}
                        onChange={e => setCreatorText(e.target.value)}
                        rows={3}
                        placeholder="Describe what you want to achieve in your own words..."
                        className="w-full bg-alabaster border border-charcoal/40 p-4 font-serif text-base text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-charcoal resize-none focus:shadow-inner"
                      />
                      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mt-3 gap-3">
                        <button
                          onClick={handleCreateGoal}
                          disabled={!creatorText.trim()}
                          className="bg-charcoal text-alabaster font-sans px-6 py-2.5 uppercase text-xs font-black tracking-widest hover:bg-forest hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-40"
                        >
                          Generate AI Plan
                        </button>
                        <div className="flex flex-wrap gap-1.5 justify-start md:justify-end">
                          {QUICK_GOALS.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => setCreatorText(q)}
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 border border-charcoal/20 hover:border-charcoal bg-alabaster text-charcoal/60 hover:text-charcoal transition-all rounded"
                            >
                              {q.length > 25 ? q.substring(0, 25) + '...' : q}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {creating && (
                    <div className="py-8 text-center space-y-4">
                      <BrainCircuit className="w-10 h-10 text-charcoal mx-auto animate-pulse" />
                      <p className="font-serif italic text-charcoal/70">EVA is building your plan...</p>
                      <div className="space-y-2.5 max-w-xs mx-auto text-left border-l border-charcoal/25 pl-4">
                        {[
                          '1. Understanding your goal',
                          '2. Detecting category & timeline',
                          '3. Generating milestone phases',
                          '4. Creating supporting habits',
                          '5. Validating against your data'
                        ].map((step, i) => (
                          <p key={i} className={`text-[10px] uppercase font-bold tracking-wider flex justify-between items-center transition-all ${
                            creatorStep > i ? 'text-forest font-black' : creatorStep === i ? 'text-charcoal animate-pulse' : 'text-charcoal/30'
                          }`}>
                            <span>{step}</span>
                            <span>{creatorStep > i ? <Check className="w-3.5 h-3.5" /> : creatorStep === i ? <ChevronRight className="w-3.5 h-3.5 animate-ping" /> : ''}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {creationPreview && !creating && (
                    <div className="space-y-5 animate-fadeIn">
                      <div className="border border-forest/35 bg-forest/[0.02] p-5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-forest flex items-center gap-1 mb-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Plan Generated</span>
                        </span>
                        <h4 className="font-serif font-bold text-xl">{creationPreview.goal?.title}</h4>
                        <p className="text-xs text-charcoal/60 font-sans mt-1">Category: {creationPreview.goal?.category} · Target: {creationPreview.goal?.targetDate}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block border-b border-charcoal/10 pb-1">Milestones ({creationPreview.milestones?.length})</span>
                          {(creationPreview.milestones || []).slice(0, 4).map((ms, i) => (
                            <p key={i} className="text-xs font-sans text-charcoal/70 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-charcoal/30 shrink-0" />
                              <span className="truncate">{ms.title}</span>
                            </p>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block border-b border-charcoal/10 pb-1">Habits ({creationPreview.habits?.length})</span>
                          {(creationPreview.habits || []).slice(0, 4).map((h, i) => (
                            <p key={i} className="text-xs font-sans text-charcoal/70 flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-forest shrink-0 stroke-[3px]" />
                              <span className="truncate">{h.title}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3 pt-3">
                        <button
                          onClick={handleConfirmGoal}
                          className="bg-charcoal text-alabaster font-sans px-5 py-2.5 uppercase text-xs font-black tracking-widest hover:bg-forest hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                          Accept & Save Goal
                        </button>
                        <button
                          onClick={() => setCreationPreview(null)}
                          className="text-xs uppercase font-bold tracking-wider border border-charcoal/20 px-5 py-2.5 hover:border-charcoal text-charcoal/60 hover:text-charcoal transition-colors"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Goals list */}
                <div className="space-y-3.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block">[ ACTIVE GOALS ]</span>
                  {goals.length === 0 ? (
                    <p className="font-serif italic text-charcoal/40 text-center py-8">No goals yet. Create your first one above.</p>
                  ) : goals.map(goal => {
                    const status = HEALTH_STATUS[goal.healthStatus] || HEALTH_STATUS.on_track;
                    const StatusIcon = status.icon;
                    const progressPct = goal.unit === '%'
                      ? goal.currentValue
                      : Math.round((goal.currentValue / goal.targetValue) * 100);
                    return (
                      <button
                        key={goal.id}
                        onClick={() => setSelectedGoal(goal)}
                        className="w-full text-left border border-charcoal/20 p-4 md:p-5 bg-alabaster hover:border-charcoal hover:-translate-y-0.5 transition-all duration-200 flex gap-4 items-start group shadow-sm"
                      >
                        <div className="p-2 border border-charcoal/10 bg-alabaster rounded shrink-0">
                          <GoalIcon icon={goal.icon} className="w-5 h-5 text-charcoal/80" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-serif font-bold group-hover:text-forest transition-colors text-charcoal text-base">{goal.title}</h4>
                            <span className={`text-[9px] uppercase font-bold tracking-wider border px-1.5 py-0.5 shrink-0 flex items-center gap-1 ${status.color}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              <span>{status.label}</span>
                            </span>
                          </div>
                          <AnimatedProgressBar value={progressPct} color={goal.healthStatus === 'behind' ? 'bg-terracotta' : 'bg-charcoal'} />
                          <div className="flex justify-between text-[10px] text-charcoal/40 font-sans font-semibold uppercase tracking-wider">
                            <span>{progressPct}% complete</span>
                            <span>{goal.remainingDays} days left · {goal.successProbability}% success</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: HABIT TRACKER ── */}
        {!loading && activeTab === 'habits' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Summary bar */}
            {habitSummary && (
              <div className="grid grid-cols-3 gap-4 border border-charcoal/15 p-4 bg-alabaster">
                {[
                  { label: "Today's Total", value: habitSummary.total, icon: ClipboardList },
                  { label: 'Completed', value: habitSummary.completed, color: 'text-forest', icon: CheckSquare },
                  { label: 'Completion Rate', value: `${habitSummary.completionPercent}%`, color: habitSummary.completionPercent >= 70 ? 'text-forest' : 'text-amber-600', icon: TrendingUp }
                ].map(s => {
                  const SummaryIcon = s.icon;
                  return (
                    <div key={s.label} className="text-center space-y-1">
                      <div className="flex items-center justify-center gap-1.5">
                        <SummaryIcon className="w-4 h-4 text-charcoal/40" />
                        <div className={`text-2xl font-serif font-black ${s.color || 'text-charcoal'}`}>{s.value}</div>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-charcoal/40 mt-1 block">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block">[ TODAY'S HABIT CHECKLIST ]</span>

            {todayHabits.length === 0 ? (
              <p className="font-serif italic text-charcoal/40 text-center py-8">No habits scheduled for today.</p>
            ) : (
              <div className="space-y-4">
                {goals.map(goal => {
                  const goalHabits = todayHabits.filter(h => h.goalId === goal.id);
                  if (goalHabits.length === 0) return null;
                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center gap-2 border-b border-charcoal/10 pb-1">
                        <GoalIcon icon={goal.icon} className="w-4 h-4 text-charcoal/50" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50">{goal.title}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {goalHabits.map(h => (
                          <HabitCheckbox key={h.id} habit={h} onLog={handleHabitLog} selectedDate={selectedDate} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Habit intelligence block */}
            <div className="border border-charcoal/15 bg-charcoal/[0.02] p-5 space-y-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block border-b border-charcoal/10 pb-2 flex items-center gap-1.5">
                <BrainCircuit className="w-4.5 h-4.5 text-charcoal/60" />
                <span>Habit Intelligence Insights</span>
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {todayHabits.filter(h => h.completionRate > 0).slice(0, 3).map(h => (
                  <div key={h.id} className="border border-charcoal/10 p-4 bg-alabaster flex flex-col justify-between gap-3 hover:-translate-y-0.5 transition-all duration-200 shadow-sm">
                    <div>
                      <p className="text-sm font-sans font-semibold text-charcoal">{h.title}</p>
                      <p className="text-xs text-charcoal/50 font-sans mt-1 leading-relaxed">
                        {h.completionRate >= 80
                          ? `Strong habit. ${h.completionRate}% consistency. High success factor.`
                          : h.completionRate >= 50
                          ? `Moderate. ${h.completionRate}% consistency. Try increasing streak.`
                          : `Needs focus. Only ${h.completionRate}% consistency in logs.`}
                      </p>
                    </div>
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-[9px] uppercase font-bold tracking-wider text-charcoal/40">
                        <span>Consistency</span>
                        <span>{h.completionRate}%</span>
                      </div>
                      <AnimatedProgressBar value={h.completionRate} color={h.completionRate >= 80 ? 'bg-forest' : h.completionRate >= 50 ? 'bg-amber-500' : 'bg-terracotta'} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: INTELLIGENCE ── */}
        {!loading && activeTab === 'insights' && (
          <div className="space-y-5 animate-fadeIn">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block">[ AI CROSS-DOMAIN INTELLIGENCE ]</span>

            {/* Goal selector */}
            {goals.length > 0 && (
              <div className="flex gap-2 flex-wrap pb-2 border-b border-charcoal/10">
                {goals.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { setSelectedGoal(g); fetchInsights(g.id); }}
                    className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 border transition-all duration-200 flex items-center gap-1.5 ${
                      selectedGoal?.id === g.id
                        ? 'bg-charcoal text-alabaster border-charcoal'
                        : 'border-charcoal/20 text-charcoal/60 hover:text-charcoal hover:border-charcoal bg-alabaster'
                    }`}
                  >
                    <GoalIcon icon={g.icon} className={`w-3.5 h-3.5 ${selectedGoal?.id === g.id ? 'text-alabaster' : 'text-charcoal/60'}`} />
                    <span>{g.title}</span>
                  </button>
                ))}
              </div>
            )}

            {insightsLoading && (
              <div className="py-10 text-center space-y-3">
                <BrainCircuit className="w-8 h-8 text-charcoal mx-auto animate-pulse" />
                <p className="text-xs uppercase font-bold tracking-wider text-charcoal/40 animate-pulse">Analyzing cross-domain patterns...</p>
              </div>
            )}

            {!insightsLoading && goalInsights.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-charcoal/15 bg-alabaster/50">
                <p className="font-serif italic text-charcoal/40">
                  {selectedGoal ? 'No insights generated yet.' : 'Select a goal to view insights.'}
                </p>
              </div>
            )}

            {!insightsLoading && goalInsights.length > 0 && (
              <div className="space-y-3">
                {goalInsights.map((ins, i) => {
                  const isCritical = ins.severity === 'critical';
                  const isWarning = ins.severity === 'warning';
                  return (
                    <div
                      key={ins.id || i}
                      className={`border p-4 transition-all duration-200 hover:-translate-y-0.5 ${
                        isCritical ? 'border-terracotta/40 bg-terracotta/[0.02]' :
                        isWarning ? 'border-amber-400/40 bg-amber-400/[0.02]' :
                        'border-charcoal/15 bg-alabaster'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          {isCritical ? (
                            <AlertCircle className="w-5 h-5 text-terracotta" />
                          ) : isWarning ? (
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Lightbulb className="w-5 h-5 text-forest" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span className={`text-[9px] uppercase font-bold tracking-wider block mb-1 ${
                            ins.type === 'drift' ? 'text-terracotta font-black' :
                            ins.type === 'health_correlation' ? 'text-charcoal/50' :
                            ins.type === 'finance_correlation' ? 'text-forest' :
                            'text-charcoal/50'
                          }`}>
                            {ins.type?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <p className="text-sm font-sans leading-relaxed text-charcoal/80">{ins.message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Drift alert for at-risk goals */}
            {goals.filter(g => g.healthStatus === 'at_risk' || g.healthStatus === 'behind').map(g => (
              <div key={g.id} className="border border-amber-500/30 bg-amber-500/[0.02] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block mb-1">DRIFT DETECTED — {g.title}</span>
                    <p className="text-sm font-sans text-charcoal/70 leading-relaxed">
                      Expected progress: <strong>{g.expectedProgress}%</strong>. Actual: <strong>{g.actualProgress || g.currentValue}%</strong>.
                      Gap of <strong>{g.driftGap}%</strong> detected.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 w-full md:w-auto">
                  <button onClick={() => handleReplan(g.id, 'redistribute')} className="text-xs font-bold uppercase tracking-wider border border-amber-500 text-amber-700 px-4 py-2 hover:bg-amber-500 hover:text-white transition-all duration-200">
                    Redistribute Plan
                  </button>
                  <button onClick={() => { setSelectedGoal(g); setActiveTab('goals'); }} className="text-xs font-bold uppercase tracking-wider border border-charcoal/30 text-charcoal/60 px-4 py-2 hover:border-charcoal hover:text-charcoal transition-all duration-200">
                    View Detail
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: TODAY'S PLAN ── */}
        {!loading && activeTab === 'today' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="border-b border-charcoal/10 pb-4 flex justify-between items-end">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-1">TODAY'S GOAL PLAN</span>
                <h3 className="text-2xl font-serif font-bold text-charcoal">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
              </div>
              <Calendar className="w-6 h-6 text-charcoal/30" />
            </div>

            {goals.length === 0 ? (
              <p className="font-serif italic text-charcoal/40 text-center py-8">No active goals. Create a goal to see today's plan.</p>
            ) : (
              <div className="space-y-4">
                {goals.map(goal => {
                  const goalHabits = todayHabits.filter(h => h.goalId === goal.id);
                  return (
                    <div key={goal.id} className="border border-charcoal/15 p-5 space-y-4 bg-alabaster shadow-sm hover:border-charcoal transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-2 border border-charcoal/10 bg-alabaster rounded">
                          <GoalIcon icon={goal.icon} className="w-5 h-5 text-charcoal/80" />
                        </div>
                        <div>
                          <h4 className="font-serif font-bold text-base text-charcoal leading-snug">{goal.title}</h4>
                          <p className="text-[10px] text-charcoal/50 font-sans font-semibold uppercase tracking-wider mt-0.5">Next Action: {goal.nextAction}</p>
                        </div>
                      </div>
                      {goalHabits.length > 0 && (
                        <div className="space-y-2 pl-4 border-l border-charcoal/10">
                          {goalHabits.map(h => (
                           <HabitCheckbox key={h.id} habit={h} onLog={handleHabitLog} selectedDate={selectedDate} />
                         ))}
                        </div>
                      )}
                      {goal.linkedModule && (
                        <button
                          onClick={() => onNavigateToTab && onNavigateToTab(goal.linkedModule)}
                          className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40 hover:text-forest transition-colors ml-4 flex items-center gap-1"
                        >
                          <span>Open linked {goal.linkedModule} module</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="border border-terracotta p-4 bg-terracotta/5 text-terracotta text-sm mt-4 flex gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
