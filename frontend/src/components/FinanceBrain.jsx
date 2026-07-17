import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Utensils, 
  Car, 
  Home as HomeIcon, 
  ShoppingBag, 
  Lightbulb, 
  GraduationCap, 
  Heart, 
  Gamepad, 
  TrendingUp, 
  Package, 
  Tag, 
  AlertTriangle, 
  TrendingDown, 
  Sparkles, 
  Plus, 
  RefreshCw, 
  FileText, 
  Brain, 
  Trash2, 
  Search, 
  X, 
  ChevronUp, 
  ChevronDown, 
  ArrowRight, 
  History, 
  BarChart2, 
  BookOpen,
  ArrowLeft,
  AlertCircle,
  Target
} from 'lucide-react';

const BACKEND = 'http://localhost:5001';

const CATEGORY_ICONS = {
  Food: Utensils,
  Transport: Car,
  Housing: HomeIcon,
  Shopping: ShoppingBag,
  Bills: Lightbulb,
  Education: GraduationCap,
  Health: Heart,
  Entertainment: Gamepad,
  Investments: TrendingUp,
  Subscriptions: Package,
  Other: Tag
};

const CATEGORY_COLORS = {
  Food: 'bg-amber-100 text-amber-800 border-amber-300',
  Transport: 'bg-sky-100 text-sky-800 border-sky-300',
  Housing: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  Shopping: 'bg-pink-100 text-pink-800 border-pink-300',
  Bills: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Education: 'bg-purple-100 text-purple-800 border-purple-300',
  Health: 'bg-rose-100 text-rose-800 border-rose-300',
  Entertainment: 'bg-orange-100 text-orange-800 border-orange-300',
  Investments: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Subscriptions: 'bg-teal-100 text-teal-800 border-teal-300',
  Other: 'bg-zinc-100 text-zinc-800 border-zinc-300'
};

export default function FinanceBrain({ selectedDate }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'transactions' | 'budgets' | 'goals' | 'subscriptions' | 'advisor'
  const [dashboardData, setDashboardData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Floating quick-entry states
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [parsedExpense, setParsedExpense] = useState(null);
  const [parsingLoading, setParsingLoading] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);

  // Manual transaction states
  const [manualAmount, setManualAmount] = useState('');
  const [manualCategory, setManualCategory] = useState('Food');
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  // What-If Goal Simulator states
  const [simGoalId, setSimGoalId] = useState('');
  const [simSavingsRate, setSimSavingsRate] = useState(8000);

  // Can I Afford Simulator states
  const [affordAmount, setAffordAmount] = useState('120000');
  const [affordItem, setAffordItem] = useState('MacBook Pro');
  const [affordResult, setAffordResult] = useState(null);
  const [affordLoading, setAffordLoading] = useState(false);

  // Score counters for animation
  const [animatedScore, setAnimatedScore] = useState(0);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, insRes] = await Promise.all([
        fetch(`${BACKEND}/finance/dashboard?date=${selectedDate}`),
        fetch(`${BACKEND}/finance/insights?date=${selectedDate}`)
      ]);

      if (!dashRes.ok || !insRes.ok) {
        throw new Error('Failed to retrieve financial metrics from core.');
      }

      const dashData = await dashRes.json();
      const insData = await insRes.json();

      setDashboardData(dashData);
      setInsights(insData);

      // Pre-select first goal for simulator if present
      if (dashData.goals?.length > 0) {
        setSimGoalId(dashData.goals[0].id);
      }
    } catch (err) {
      setError(err.message || 'An error occurred fetching finance data.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Score animation trigger
  useEffect(() => {
    if (dashboardData?.healthScore !== undefined) {
      let current = 0;
      const target = dashboardData.healthScore;
      const timer = setInterval(() => {
        if (current < target) {
          current += 1;
          setAnimatedScore(current);
        } else {
          clearInterval(timer);
        }
      }, 15);
      return () => clearInterval(timer);
    }
  }, [dashboardData?.healthScore]);

  // Handle parse natural language prompt
  const handleParsePrompt = async () => {
    if (!quickInput.trim()) return;
    setParsingLoading(true);
    setParsedExpense(null);
    try {
      const res = await fetch(`${BACKEND}/finance/expense/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickInput })
      });
      if (!res.ok) throw new Error('Parsing prompt failed.');
      const data = await res.json();
      setParsedExpense(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setParsingLoading(false);
    }
  };

  // Confirm and save parsed expense
  const handleSaveParsed = async () => {
    if (!parsedExpense) return;
    setSavingLoading(true);
    try {
      const res = await fetch(`${BACKEND}/finance/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsedExpense, date: selectedDate })
      });
      if (!res.ok) throw new Error('Saving transaction failed.');
      
      // Reset & refresh
      setQuickInput('');
      setParsedExpense(null);
      setShowQuickAdd(false);
      await fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingLoading(false);
    }
  };

  // Add manual transaction
  const handleAddManual = async (e) => {
    e.preventDefault();
    if (!manualAmount || isNaN(manualAmount)) return;
    setSavingLoading(true);
    try {
      const res = await fetch(`${BACKEND}/finance/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(manualAmount),
          category: manualCategory,
          merchant: manualMerchant || 'Manual Entry',
          description: manualDesc || manualCategory,
          date: selectedDate
        })
      });
      if (!res.ok) throw new Error('Failed to log manual expense.');

      setManualAmount('');
      setManualMerchant('');
      setManualDesc('');
      await fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingLoading(false);
    }
  };

  // Run purchase simulator
  const handleSimulateAfford = () => {
    if (!affordAmount || isNaN(affordAmount)) return;
    setAffordLoading(true);
    
    // Simulate what-if purchase comparison logic locally
    setTimeout(() => {
      const amt = parseFloat(affordAmount);
      const ef = dashboardData?.emergencyFund || { target: 150000, current: 90000 };
      const remainingCash = dashboardData?.saved || 21600;

      // Risk scoring
      const efPost = ef.current - amt;
      const efRisk = efPost < ef.target * 0.5 ? '⚠️ Low' : efPost < ef.target ? 'Moderate' : 'Healthy';
      const goalDelay = Math.round(amt / 15000); // 15k average savings rate
      
      setAffordResult({
        item: affordItem || 'Desired Purchase',
        amount: amt,
        today: {
          ef: efPost < ef.target * 0.5 ? '⚠️ Low' : 'Moderate',
          goal: `Delayed ${goalDelay} months`,
          flow: amt > remainingCash ? '⚠️ Moderate Risk' : 'Healthy'
        },
        future: {
          ef: 'Healthy',
          goal: 'On Track',
          flow: 'Healthy'
        },
        recommendation: efPost < ef.target * 0.5 
          ? `Wait 3 months. Accumulate ₹${Math.round(amt/3).toLocaleString('en-IN')}/month to secure this without depleting your essential emergency vault.`
          : `Feasible now, but consider saving half over the next 4 weeks to avoid cashflow ripples.`
      });
      setAffordLoading(false);
    }, 800);
  };

  if (loading) {
    return (
      <div className="border border-charcoal p-12 text-center bg-alabaster">
        <div className="text-3xl animate-bounce mb-3">💰</div>
        <div className="font-serif italic text-lg animate-pulse text-charcoal/80">
          Loading financial matrices and predictions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-terracotta p-6 bg-terracotta/5 text-terracotta">
        <div className="text-xs uppercase font-bold tracking-wider mb-2">[ CRITICAL ACCESS FAILED ]</div>
        <p className="text-sm font-sans">{error}</p>
        <button onClick={fetchAllData} className="mt-4 px-4 py-2 bg-terracotta text-alabaster text-xs font-bold uppercase tracking-wider">
          Retry Sync
        </button>
      </div>
    );
  }

  // Get active simulated goal
  const activeSimGoal = dashboardData?.goals?.find(g => g.id === simGoalId);
  const remainingGoalAmt = activeSimGoal ? Math.max(0, activeSimGoal.target_amount - activeSimGoal.current_amount) : 0;
  const simMonths = simSavingsRate > 0 ? Math.ceil(remainingGoalAmt / simSavingsRate) : 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── MODULE HEADER ── */}
      <div className="border border-charcoal p-6 md:p-8 bg-alabaster flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-2">[ ECONOMIC INTEL MODULE ]</span>
          <h2 className="text-4xl font-serif font-black leading-none tracking-tight">Finance Brain</h2>
          <p className="text-sm text-charcoal/60 font-sans mt-2 max-w-lg leading-relaxed">
            Every transaction, analyzed. Forecasts your savings trajectory, highlights silent subscription leaks, and tests purchase readiness.
          </p>
        </div>
        <button
          onClick={() => setShowQuickAdd(true)}
          className="bg-charcoal text-alabaster px-5 py-2.5 font-sans uppercase text-xs font-black tracking-widest hover:bg-forest transition-colors border border-charcoal shadow-[3px_3px_0px_0px_rgba(30,32,30,1)] shrink-0 flex items-center gap-1.5 hover:-translate-y-0.5 transition-transform"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Quick Add</span>
        </button>
      </div>

      {/* ── TAB BAR ── */}
      <div className="border border-charcoal bg-alabaster p-1 flex gap-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'transactions', label: 'Ledger', icon: BookOpen },
          { id: 'budgets', label: 'Budgets', icon: Lightbulb },
          { id: 'goals', label: 'Goals', icon: Target },
          { id: 'subscriptions', label: 'Vault', icon: Package },
          { id: 'advisor', label: 'Affordability', icon: Brain }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-sans border transition-all shrink-0 flex items-center gap-2 hover:-translate-y-0.5 ${
                activeTab === t.id
                  ? 'bg-charcoal text-alabaster border-charcoal'
                  : 'border-transparent text-charcoal/60 hover:text-charcoal'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="border border-charcoal p-5 md:p-7 bg-alabaster">

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Health Score Dial */}
              <div className="md:col-span-4 border border-charcoal p-6 flex flex-col items-center justify-center bg-alabaster relative">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 absolute top-4 left-4">[ HEALTH COEFFICIENT ]</span>
                <div className="w-32 h-32 flex items-center justify-center relative mt-4">
                  <div className="text-center z-10">
                    <span className="text-4xl font-serif font-black">{animatedScore}</span>
                    <span className="text-xs text-charcoal/40 block border-t border-charcoal/10 pt-1 mt-1">/ 100</span>
                  </div>
                  {/* Gauge Arc representation */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
                    {/* Background Track */}
                    <circle
                      cx="64" cy="64" r="58"
                      stroke="rgba(30, 32, 30, 0.1)" strokeWidth="4"
                      fill="transparent"
                    />
                    {/* Active Progress Arc */}
                    <circle
                      cx="64" cy="64" r="58"
                      stroke="#446b4f" strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="364.4"
                      strokeDashoffset={364.4 - (364.4 * (dashboardData?.healthScore || 0)) / 100}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                </div>
                <div className="text-[11px] font-sans text-charcoal/50 text-center mt-4 uppercase tracking-wider">
                  Healthy ↑ 6% this month
                </div>
              </div>

              {/* Cashflow Summary Cards */}
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-charcoal p-5 bg-alabaster">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-2">Available Cash</span>
                  <div className="text-3xl font-serif font-bold text-forest">₹{(dashboardData?.saved || 0).toLocaleString('en-IN')}</div>
                  <p className="text-xs text-charcoal/50 font-sans mt-2">Discretionary capital safe for spending.</p>
                </div>
                <div className="border border-charcoal p-5 bg-alabaster">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-2">Monthly Outflow</span>
                  <div className="text-3xl font-serif font-bold text-terracotta">₹{(dashboardData?.spent || 0).toLocaleString('en-IN')}</div>
                  <div className="w-full bg-charcoal/10 h-1.5 mt-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-terracotta transition-all duration-700"
                      style={{ width: `${Math.min(100, ((dashboardData?.spent || 0) / (dashboardData?.monthlyBudget || 40000)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-charcoal/40 font-sans mt-1">₹{(dashboardData?.monthlyBudget || 0).toLocaleString('en-IN')} budget cap</p>
                </div>
              </div>
            </div>

            {/* AI Money Story Section */}
            {insights?.story && (
              <div className="border border-forest p-6 bg-forest/5 shadow-[3px_3px_0px_0px_rgba(68,107,79,0.2)]">
                <span className="text-xs uppercase font-bold tracking-wider text-forest block mb-2">[ YOUR MONEY STORY ]</span>
                <p className="font-serif italic text-base leading-relaxed text-charcoal">
                  "{insights.story}"
                </p>
              </div>
            )}

            {/* Smart Alerts list */}
            {insights?.alerts?.length > 0 && (
              <div className="border border-charcoal/20 p-5 bg-alabaster space-y-2 animate-fadeIn">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-2">[ SYSTEM FINANCIAL NOTICES ]</span>
                {insights.alerts.map((a, i) => (
                  <div key={i} className="text-xs font-sans flex items-start gap-2 text-charcoal/80">
                    <AlertTriangle className="w-3.5 h-3.5 text-terracotta mt-0.5 shrink-0" />
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: LEDGER */}
        {activeTab === 'transactions' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50">[ RECENT TRANSACTIONS ]</span>
              <button
                onClick={() => setShowQuickAdd(true)}
                className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1.5 hover:-translate-y-0.5 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Insert Transaction</span>
              </button>
            </div>
            
            {dashboardData?.transactions?.length === 0 ? (
              <div className="border border-dashed border-charcoal/30 p-12 text-center animate-fadeIn">
                <p className="font-serif italic text-charcoal/50">No logged expenses.</p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal/10">
                {dashboardData.transactions.map(t => (
                  <div key={t.id} className="py-4 flex items-center justify-between hover:bg-charcoal/5 px-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 flex items-center justify-center border border-charcoal/10 bg-alabaster rounded-full">
                        {(() => {
                          const IconComp = CATEGORY_ICONS[t.category] || Tag;
                          return <IconComp className="w-5 h-5 text-charcoal/70" />;
                        })()}
                      </span>
                      <div>
                        <div className="text-sm font-serif font-semibold text-charcoal">{t.merchant}</div>
                        <div className="text-xs text-charcoal/50 font-sans">{t.description}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-serif font-bold text-charcoal">₹{t.amount.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-charcoal/40 font-sans">{t.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: BUDGETS */}
        {activeTab === 'budgets' && (
          <div className="space-y-6 animate-fadeIn">
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-2">[ CATEGORY BUDGET STATUS ]</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(dashboardData?.budgets || {}).map(([cat, limit]) => {
                const spent = dashboardData?.categorySpent?.[cat] || 0;
                const percent = Math.min(100, Math.round((spent / limit) * 100));
                return (
                  <div key={cat} className="border border-charcoal/20 p-5 bg-alabaster">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const IconComp = CATEGORY_ICONS[cat] || Tag;
                          return <IconComp className="w-4.5 h-4.5 text-charcoal/70" />;
                        })()}
                        <span className="text-sm font-serif font-bold">{cat} Budget</span>
                      </div>
                      <span className="text-xs text-charcoal/50 font-sans">
                        ₹{spent.toLocaleString('en-IN')} / ₹{limit.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="w-full bg-charcoal/10 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 ${
                          percent >= 90 ? 'bg-terracotta' :
                          percent >= 75 ? 'bg-amber-500' :
                          'bg-forest'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-charcoal/40 font-sans">{percent}% Used</span>
                      {percent >= 90 && (
                        <span className="text-[9px] uppercase tracking-wider font-bold text-terracotta border border-terracotta/30 px-1.5 py-0.5 animate-pulse bg-terracotta/5 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-terracotta" />
                          <span>Overuse warning</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: GOALS */}
        {activeTab === 'goals' && (
          <div className="space-y-6">
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-2">[ LONG-TERM FINANCIAL GOALS ]</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {dashboardData?.goals?.map(g => {
                const percent = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                return (
                  <div key={g.id} className="border border-charcoal p-5 bg-alabaster relative flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-charcoal/40">Goal</span>
                      <h4 className="text-lg font-serif font-bold text-charcoal mt-1">{g.name}</h4>
                      <div className="text-xl font-serif font-black text-forest mt-2">
                        ₹{g.current_amount.toLocaleString('en-IN')} <span className="text-xs text-charcoal/40 block font-normal mt-0.5">of ₹{g.target_amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="w-full bg-charcoal/10 h-2 mt-3 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-forest transition-all duration-700"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-charcoal/10 text-xs text-charcoal/50 font-sans flex justify-between items-center">
                      <span>{percent}% Completed</span>
                      <span className="bg-charcoal/5 px-2 py-0.5 text-[10px] font-bold text-charcoal uppercase tracking-wider">
                        ETA: 11 months
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Goal Simulator */}
            {activeSimGoal && (
              <div className="border border-charcoal/30 p-6 bg-alabaster mt-5">
                <span className="text-xs uppercase font-bold tracking-wider text-charcoal/60 block mb-4">
                  [ GOAL VELOCITY SIMULATOR ]
                </span>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-sans text-charcoal">Simulate target goal:</label>
                    <select
                      value={simGoalId}
                      onChange={(e) => setSimGoalId(e.target.value)}
                      className="bg-alabaster border border-charcoal/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal outline-none"
                    >
                      {dashboardData.goals.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-charcoal/50 mb-1 font-sans">
                      <span>Monthly savings target</span>
                      <span className="font-bold text-forest">₹{simSavingsRate.toLocaleString('en-IN')} / month</span>
                    </div>
                    <input
                      type="range"
                      min="2000"
                      max="30000"
                      step="1000"
                      value={simSavingsRate}
                      onChange={(e) => setSimSavingsRate(parseInt(e.target.value))}
                      className="w-full accent-forest cursor-pointer"
                    />
                  </div>

                  <div className="border border-dashed border-charcoal/20 p-4 bg-alabaster/50 text-center">
                    <span className="text-xs uppercase tracking-wider text-charcoal/50 block mb-1">Estimated Completion</span>
                    <div className="text-2xl font-serif font-black text-charcoal">{simMonths} Months</div>
                    <p className="text-[10px] text-charcoal/40 font-sans mt-1">
                      Targeting ₹{remainingGoalAmt.toLocaleString('en-IN')} remaining deficit.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: SUBSCRIPTIONS */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-charcoal p-5 bg-alabaster">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-1">Monthly Subscription Cost</span>
                <div className="text-2xl font-serif font-bold text-charcoal">₹1,898</div>
              </div>
              <div className="border border-charcoal p-5 bg-alabaster">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-1">Yearly Vault Leak</span>
                <div className="text-2xl font-serif font-bold text-charcoal">₹22,776</div>
              </div>
            </div>

            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-2">[ ACTIVE VAULT SUBSCRIPTIONS ]</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboardData?.subscriptions?.map(s => {
                const isUnused = s.lastUsedDaysAgo > 30;
                return (
                  <div key={s.id} className={`border p-5 bg-alabaster relative ${isUnused ? 'border-terracotta shadow-[2px_2px_0px_0px_rgba(209,73,73,0.15)]' : 'border-charcoal/20'}`}>
                    {isUnused && (
                      <span className="absolute -top-2 left-4 bg-terracotta text-alabaster text-[9px] uppercase font-bold tracking-wider px-2 py-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-alabaster" />
                        <span>Leak detected — {s.lastUsedDaysAgo} days unused</span>
                      </span>
                    )}
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col items-start">
                        <Package className="w-6 h-6 text-charcoal/60" />
                        <h4 className="text-sm font-serif font-bold mt-2">{s.name}</h4>
                        <p className="text-xs text-charcoal/40 font-sans mt-0.5 font-bold">Next renewal: {s.next_billing_date}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-serif font-bold text-charcoal">₹{s.amount}</span>
                        <span className="text-[10px] text-charcoal/50 block uppercase tracking-wider font-sans">/ {s.billing_cycle}</span>
                      </div>
                    </div>
                    {isUnused && (
                      <button
                        onClick={() => alert(`We will prompt a cancellation reminder for ${s.name} before ${s.next_billing_date}.`)}
                        className="w-full mt-4 border border-terracotta text-terracotta py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-terracotta hover:text-alabaster transition-all hover:-translate-y-0.5 transition-transform"
                      >
                        Cancel subscription
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: ADVISOR */}
        {activeTab === 'advisor' && (
          <div className="space-y-6">
            <div className="border border-charcoal p-5 bg-alabaster">
              <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ PURCHASE CAPABILITY ANALYZER ]</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-charcoal/60 font-sans block mb-1">Desired Purchase / Asset</label>
                  <input
                    type="text"
                    value={affordItem}
                    onChange={(e) => setAffordItem(e.target.value)}
                    className="w-full bg-alabaster border border-charcoal/30 px-3 py-2 text-sm outline-none text-charcoal"
                  />
                </div>
                <div>
                  <label className="text-xs text-charcoal/60 font-sans block mb-1">Asset Value (₹)</label>
                  <input
                    type="text"
                    value={affordAmount}
                    onChange={(e) => setAffordAmount(e.target.value)}
                    className="w-full bg-alabaster border border-charcoal/30 px-3 py-2 text-sm outline-none text-charcoal"
                  />
                </div>
              </div>
              <button
                onClick={handleSimulateAfford}
                disabled={affordLoading}
                className="w-full bg-charcoal text-alabaster py-2 text-xs font-bold uppercase tracking-widest border border-charcoal hover:bg-forest transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {affordLoading ? 'Evaluating capability parameters...' : 'Evaluate Capability'}
              </button>
            </div>

            {/* Sim result */}
            {affordResult && (
              <div className="border border-charcoal p-5 bg-alabaster animate-fadeIn space-y-4">
                <span className="text-xs uppercase font-bold tracking-wider text-forest block">[ SIMULATION RESULTS: {affordResult.item} ]</span>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="border border-charcoal/10 p-4">
                    <span className="text-xs uppercase font-bold tracking-wider text-charcoal/40 block mb-3">If Purchased Today</span>
                    <ul className="text-xs font-sans space-y-2 text-left">
                      <li className="flex justify-between">
                        <span>Emergency Fund:</span>
                        <span className="font-bold text-terracotta">{affordResult.today.ef}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Savings Goal:</span>
                        <span className="font-bold text-amber-600">{affordResult.today.goal}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Cashflow Risk:</span>
                        <span className="font-bold text-terracotta">{affordResult.today.flow}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="border border-forest/20 p-4 bg-forest/5">
                    <span className="text-xs uppercase font-bold tracking-wider text-forest block mb-3">If Delayed 3 Months</span>
                    <ul className="text-xs font-sans space-y-2 text-left text-forest">
                      <li className="flex justify-between">
                        <span>Emergency Fund:</span>
                        <span className="font-bold">{affordResult.future.ef}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Savings Goal:</span>
                        <span className="font-bold">{affordResult.future.goal}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Cashflow Risk:</span>
                        <span className="font-bold">{affordResult.future.flow}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border border-forest p-4 bg-forest/5 text-xs text-forest font-serif leading-relaxed">
                  <span className="font-bold uppercase font-sans text-[10px] tracking-wider block mb-1">Orbit RECOMENDED PATHWAYS:</span>
                  "{affordResult.recommendation}"
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── MANUAL INSERT CARD (timeline insert) ── */}
      {activeTab === 'transactions' && (
        <form onSubmit={handleAddManual} className="border border-charcoal p-5 bg-alabaster space-y-4">
          <span className="text-xs uppercase font-bold tracking-wider text-charcoal/60 block">[ TRANSACTION INSERT LEDGER ]</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] text-charcoal/40 font-sans block mb-1">Amount (₹)</label>
              <input
                type="text"
                placeholder="450"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="w-full bg-alabaster border border-charcoal/30 px-3 py-1.5 text-xs outline-none text-charcoal"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-charcoal/40 font-sans block mb-1">Category</label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                className="w-full bg-alabaster border border-charcoal/30 px-3 py-1.5 text-xs outline-none text-charcoal"
              >
                {Object.keys(CATEGORY_ICONS).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-charcoal/40 font-sans block mb-1">Merchant</label>
              <input
                type="text"
                placeholder="Zomato"
                value={manualMerchant}
                onChange={(e) => setManualMerchant(e.target.value)}
                className="w-full bg-alabaster border border-charcoal/30 px-3 py-1.5 text-xs outline-none text-charcoal"
              />
            </div>
            <div>
              <label className="text-[10px] text-charcoal/40 font-sans block mb-1">Description</label>
              <input
                type="text"
                placeholder="Dinner with friend"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="w-full bg-alabaster border border-charcoal/30 px-3 py-1.5 text-xs outline-none text-charcoal"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingLoading}
            className="px-4 py-2 bg-charcoal text-alabaster text-xs font-bold uppercase tracking-wider hover:bg-forest transition-all"
          >
            {savingLoading ? 'Logging transaction...' : 'Log Expense'}
          </button>
        </form>
      )}

      {/* ── FLOATING QUICK ADD SHEET ── */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-charcoal bg-alabaster p-6 max-w-md w-full animate-fadeIn shadow-[6px_6px_0px_0px_rgba(30,32,30,1)] relative">
            <button
              onClick={() => { setShowQuickAdd(false); setParsedExpense(null); }}
              className="absolute top-4 right-4 text-xs font-bold uppercase tracking-wider text-charcoal/40 hover:text-charcoal flex items-center gap-1 hover:-translate-y-0.5 transition-transform"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
            <span className="text-xs uppercase font-bold tracking-wider text-forest block mb-2">[ NATURAL LANGUAGE TRANSACTION ENTRY ]</span>
            <h3 className="text-xl font-serif font-bold text-charcoal mb-4">Smart Entry</h3>
            
            <div className="space-y-4">
              <textarea
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                rows={3}
                placeholder='e.g. "Spent 450 on dinner at Zomato" · "Uber ride for 350"'
                className="w-full bg-alabaster border border-charcoal/40 p-3 font-serif text-sm focus:outline-none focus:border-charcoal resize-none"
                disabled={parsingLoading || savingLoading}
              />
              <button
                onClick={handleParsePrompt}
                disabled={parsingLoading || !quickInput.trim()}
                className="w-full bg-charcoal text-alabaster py-2 text-xs font-bold uppercase tracking-widest hover:bg-forest transition-all border border-charcoal disabled:opacity-40"
              >
                {parsingLoading ? 'Extracting parameters...' : 'Analyze Prompt'}
              </button>

              {/* Parser Confirmation Card */}
              {parsedExpense && (
                <div className="border border-forest p-4 bg-forest/5 animate-fadeIn space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-forest block">[ PARSED TRANSACTION DETAILS ]</span>
                  <div className="grid grid-cols-2 gap-3 text-xs font-sans">
                    <div>
                      <span className="text-charcoal/50 block">Amount:</span>
                      <span className="font-bold text-sm text-charcoal">₹{parsedExpense.amount}</span>
                    </div>
                    <div>
                      <span className="text-charcoal/50 block">Category:</span>
                      <span className="font-bold text-charcoal">{parsedExpense.category}</span>
                    </div>
                    <div>
                      <span className="text-charcoal/50 block">Merchant:</span>
                      <span className="font-bold text-charcoal">{parsedExpense.merchant}</span>
                    </div>
                    <div>
                      <span className="text-charcoal/50 block">Description:</span>
                      <span className="font-bold text-charcoal">{parsedExpense.description}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveParsed}
                    disabled={savingLoading}
                    className="w-full bg-forest text-alabaster py-2 text-xs font-bold uppercase tracking-widest hover:bg-charcoal transition-all border border-forest"
                  >
                    {savingLoading ? 'Confirming...' : 'Confirm & Log'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
