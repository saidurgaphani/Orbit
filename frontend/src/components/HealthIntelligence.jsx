import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';
import { auth } from '../firebase';

const BACKEND = 'http://localhost:5001';

export default function HealthIntelligence({ selectedDate }) {
  // Connection states
  const [syncing, setSyncing] = useState(false);
  const [connectedFit, setConnectedFit] = useState(false);
  const [connectedConnect, setConnectedConnect] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [metricsData, setMetricsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncWarning, setSyncWarning] = useState('');

  // Active chart tab (steps, sleep, heartRate, weight, water)
  const [activeChart, setActiveChart] = useState('steps');

  // Manual logs states
  const [logWeight, setLogWeight] = useState('');
  const [logBP, setLogBP] = useState('');
  const [logBS, setLogBS] = useState('');
  const [logMood, setLogMood] = useState('Energetic');
  const [showLogModal, setShowLogModal] = useState(false);
  const [submittingLog, setSubmittingLog] = useState(false);

  // New medication form states
  const [showMedForm, setShowMedForm] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('Daily');
  const [medRefill, setMedRefill] = useState(false);
  const [medRefillCount, setMedRefillCount] = useState('30');
  const [medications, setMedications] = useState([]);

  // Medical report upload states
  const [reportFile, setReportFile] = useState(null);
  const [reportBase64, setReportBase64] = useState('');
  const [reportMime, setReportMime] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const [reportError, setReportError] = useState('');
  const fileInputRef = useRef(null);

  // Fetch all dashboard & metric data
  const fetchData = async (showPulse = false) => {
    if (showPulse) setLoading(true);
    try {
      const dbRes = await fetch(`${BACKEND}/health/dashboard?date=${selectedDate}`);
      if (!dbRes.ok) throw new Error('Failed to fetch dashboard telemetry.');
      const dbData = await dbRes.json();
      setDashboardData(dbData);
      setConnectedFit(dbData.profile?.connectedGoogleFit || false);
      setConnectedConnect(dbData.profile?.connectedHealthConnect || false);

      const metricsRes = await fetch(`${BACKEND}/health/metrics?date=${selectedDate}`);
      if (!metricsRes.ok) throw new Error('Failed to fetch historical telemetry.');
      const metData = await metricsRes.json();
      setMetricsData(metData);

      const medsRes = await fetch(`${BACKEND}/health/medications`);
      if (medsRes.ok) {
        const medsData = await medsRes.json();
        setMedications(medsData);
      }

      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error syncing with health database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [selectedDate]);

  const handleInitiateOAuth = async () => {
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

  // Trigger Google Fit / Health Connect real or mock sync
  const handleSync = async (type) => {
    setSyncing(true);
    setError('');
    setSyncWarning('');
    try {
      const res = await fetch(`${BACKEND}/health/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google-fit', type })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401 && errData.error === 'unlinked') {
          if (window.confirm('Google Account is not linked. Redirect to Google authentication to link and grant Fit permissions?')) {
            const idToken = await auth.currentUser?.getIdToken();
            window.location.href = `${BACKEND}/auth/google?token=${idToken}`;
            return;
          }
          throw new Error('Sync cancelled: Google Account not linked.');
        }
        throw new Error(errData.message || 'Sync failed.');
      }
      
      const data = await res.json();
      if (data.warning) {
        setSyncWarning(data.warning);
      } else {
        setSyncWarning('');
      }
      
      await fetchData();
    } catch (err) {
      setSyncWarning(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Water Quick Log
  const handleLogWater = async (amount) => {
    try {
      const res = await fetch(`${BACKEND}/health/manual-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'water', value: amount, date: selectedDate })
      });
      if (!res.ok) throw new Error('Failed to log water.');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Submit General Logs
  const handleLogSubmit = async (e) => {
    e.preventDefault();
    setSubmittingLog(true);
    try {
      if (logWeight) {
        await fetch(`${BACKEND}/health/manual-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'weight', value: parseFloat(logWeight), date: selectedDate })
        });
      }
      if (logBP) {
        await fetch(`${BACKEND}/health/manual-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'bloodPressure', value: logBP, date: selectedDate })
        });
      }
      if (logBS) {
        await fetch(`${BACKEND}/health/manual-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'bloodSugar', value: parseInt(logBS), date: selectedDate })
        });
      }
      if (logMood) {
        await fetch(`${BACKEND}/health/manual-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'mood', value: logMood, date: selectedDate })
        });
      }
      
      setLogWeight('');
      setLogBP('');
      setLogBS('');
      setShowLogModal(false);
      await fetchData();
    } catch (err) {
      alert('Error saving metrics: ' + err.message);
    } finally {
      setSubmittingLog(false);
    }
  };

  // Check Off Medication
  const handleMedToggle = async (medId, currentlyTaken) => {
    try {
      const res = await fetch(`${BACKEND}/health/manual-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'medication', medicationId: medId, value: !currentlyTaken, date: selectedDate })
      });
      if (!res.ok) throw new Error('Failed to update medication adherence.');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Refill Medication
  const handleMedRefill = async (medId) => {
    try {
      const res = await fetch(`${BACKEND}/health/medications/${medId}/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 30 })
      });
      if (!res.ok) throw new Error('Refill failed.');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Add Medication Form Submit
  const handleAddMed = async (e) => {
    e.preventDefault();
    if (!medName || !medDosage) return;
    try {
      const res = await fetch(`${BACKEND}/health/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: medName,
          dosage: medDosage,
          frequency: medFreq,
          refillReminder: medRefill,
          refillCount: medRefill ? parseInt(medRefillCount) : 0
        })
      });
      if (!res.ok) throw new Error('Failed to add medication.');
      setMedName('');
      setMedDosage('');
      setMedFreq('Daily');
      setMedRefill(false);
      setShowMedForm(false);
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // OCR Medical Report Upload Handler
  const handleReportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setReportError('Only images (JPEG/PNG/WebP) and PDFs are supported.');
      return;
    }

    setReportFile(file);
    setReportMime(file.type);
    setReportError('');
    setReportResult(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      setReportBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleReportAnalyze = async () => {
    if (!reportBase64) return;
    setReportLoading(true);
    setReportError('');
    try {
      const res = await fetch(`${BACKEND}/health/report/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: reportBase64,
          fileName: reportFile.name,
          fileType: reportMime
        })
      });
      if (!res.ok) throw new Error('Analysis failed.');
      const data = await res.json();
      setReportResult(data);
    } catch (err) {
      setReportError(err.message || 'Failed to parse medical report.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleClearReport = () => {
    setReportFile(null);
    setReportBase64('');
    setReportResult(null);
    setReportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Trigger AI Insights Generation
  const handleRefreshInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/health/insights`);
      if (res.ok) {
        const insights = await res.json();
        setDashboardData(prev => ({ ...prev, insights }));
      }
    } catch (err) {
      console.warn('Failed to refresh insights', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="border border-charcoal p-12 text-center bg-alabaster space-y-4">
        <div className="font-serif italic text-2xl animate-pulse text-charcoal/80">
          Syncing biometric streams and health history...
        </div>
        <div className="text-[10px] uppercase tracking-widest text-charcoal/40 font-mono">
          Retrieving medical ledgers & calculating body scores
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const score = dashboardData?.healthScore || 50;
  const components = dashboardData?.components || {};
  const summary = dashboardData?.dailySummary || {};
  const timeline = dashboardData?.timeline || [];
  const recommendations = dashboardData?.recommendations || [];
  const insights = dashboardData?.insights || [];
  const profile = dashboardData?.profile || {};

  // Custom Chart Drawer based on active tab
  const renderSVGChart = () => {
    if (!metricsData || !metricsData.dates || metricsData.dates.length === 0) {
      return (
        <div className="h-48 flex justify-center items-center font-serif text-charcoal/40 italic">
          No metrics available. Connect a source or log data manually.
        </div>
      );
    }

    const dates = metricsData.dates;
    const values = metricsData[activeChart] || [];
    const formattedDates = dates.map(d => {
      const parts = d.split('-');
      return `${parts[1]}/${parts[2]}`; // MM/DD
    });

    const width = 600;
    const height = 200;
    const padding = 35;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    if (activeChart === 'steps' || activeChart === 'water') {
      // BAR CHART
      const maxVal = Math.max(...values, activeChart === 'steps' ? 10000 : 3.0) || 1;
      const barWidth = (chartWidth / values.length) * 0.6;
      const barSpacing = (chartWidth / values.length) * 0.4;

      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full font-sans text-[10px]">
          {/* Grids */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + chartHeight * (1 - ratio);
            const valLabel = Math.round(maxVal * ratio);
            return (
              <g key={idx} className="opacity-20">
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1E201E" strokeWidth="1" strokeDasharray="3,3" />
                <text x={padding - 5} y={y + 3} textAnchor="end" className="fill-charcoal select-none">
                  {activeChart === 'water' ? (valLabel).toFixed(1) + 'L' : valLabel.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {values.map((val, idx) => {
            const x = padding + idx * (barWidth + barSpacing) + barSpacing / 2;
            const barHeight = (val / maxVal) * chartHeight;
            const y = padding + chartHeight - barHeight;
            const isToday = idx === values.length - 1;

            return (
              <g key={idx} className="group cursor-pointer">
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  className={`${isToday ? 'fill-forest' : 'fill-charcoal/30'} group-hover:fill-forest/80 transition-colors`}
                  rx="2"
                />
                {/* Tooltip on hover */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-charcoal font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {activeChart === 'water' ? val + 'L' : val.toLocaleString()}
                </text>
                {/* Date Label */}
                <text x={x + barWidth / 2} y={height - padding + 15} textAnchor="middle" className="fill-charcoal/60 select-none">
                  {formattedDates[idx]}
                </text>
              </g>
            );
          })}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1E201E" strokeWidth="1.5" />
        </svg>
      );
    } else if (activeChart === 'sleep') {
      // SLEEP ARCHITECTURE (Stacked Bar Chart: Deep, REM, Light)
      const sleepDetails = metricsData.sleepDetails || [];
      const maxVal = Math.max(...values, 8) || 1; // max sleep duration in hours
      const barWidth = (chartWidth / values.length) * 0.6;
      const barSpacing = (chartWidth / values.length) * 0.4;

      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full font-sans text-[10px]">
          {/* Grids */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + chartHeight * (1 - ratio);
            const valLabel = Math.round(maxVal * ratio);
            return (
              <g key={idx} className="opacity-20">
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1E201E" strokeWidth="1" strokeDasharray="3,3" />
                <text x={padding - 5} y={y + 3} textAnchor="end" className="fill-charcoal select-none">
                  {valLabel}h
                </text>
              </g>
            );
          })}

          {/* Stacked Bars */}
          {values.map((totalHrs, idx) => {
            const details = sleepDetails[idx] || { deep: 0, rem: 0, light: 0 };
            const deepHrs = details.deep / 60;
            const remHrs = details.rem / 60;
            const lightHrs = details.light / 60;

            const x = padding + idx * (barWidth + barSpacing) + barSpacing / 2;
            
            const deepHeight = (deepHrs / maxVal) * chartHeight;
            const remHeight = (remHrs / maxVal) * chartHeight;
            const lightHeight = (lightHrs / maxVal) * chartHeight;

            const yDeep = padding + chartHeight - deepHeight;
            const yRem = yDeep - remHeight;
            const yLight = yRem - lightHeight;

            return (
              <g key={idx} className="group cursor-pointer">
                {/* Deep sleep: Forest Green */}
                <rect x={x} y={yDeep} width={barWidth} height={deepHeight} className="fill-forest" rx="1" />
                {/* REM sleep: Sage */}
                <rect x={x} y={yRem} width={barWidth} height={remHeight} className="fill-sage" rx="1" />
                {/* Light sleep: Charcoal/15 */}
                <rect x={x} y={yLight} width={barWidth} height={lightHeight} className="fill-charcoal/20 border border-charcoal/10" rx="1" />

                {/* Tooltip on hover */}
                <text
                  x={x + barWidth / 2}
                  y={yLight - 6}
                  textAnchor="middle"
                  className="fill-charcoal font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {totalHrs}h ({Math.round(details.deep/60)}D/{Math.round(details.rem/60)}R)
                </text>
                {/* Date Label */}
                <text x={x + barWidth / 2} y={height - padding + 15} textAnchor="middle" className="fill-charcoal/60 select-none">
                  {formattedDates[idx]}
                </text>
              </g>
            );
          })}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1E201E" strokeWidth="1.5" />
        </svg>
      );
    } else {
      // LINE CHART (Heart Rate / Weight)
      const maxVal = Math.max(...values) || 1;
      const minVal = Math.min(...values) || 0;
      const spread = maxVal - minVal || 1;
      
      // Pad min/max slightly for better chart visual boundaries
      const yMax = maxVal + spread * 0.1;
      const yMin = Math.max(0, minVal - spread * 0.1);
      const ySpread = yMax - yMin;

      // Map values to coordinates
      const points = values.map((val, idx) => {
        const x = padding + (idx / (values.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((val - yMin) / ySpread) * chartHeight;
        return { x, y, val };
      });

      const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full font-sans text-[10px]">
          {/* Grids */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + chartHeight * (1 - ratio);
            const valLabel = Math.round(yMin + ySpread * ratio);
            return (
              <g key={idx} className="opacity-20">
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1E201E" strokeWidth="1" strokeDasharray="3,3" />
                <text x={padding - 5} y={y + 3} textAnchor="end" className="fill-charcoal select-none">
                  {valLabel} {activeChart === 'weight' ? 'kg' : 'bpm'}
                </text>
              </g>
            );
          })}

          {/* Line Path */}
          <path d={linePath} fill="none" stroke="#375534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Nodes */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle cx={p.x} cy={p.y} r="4" className="fill-alabaster stroke-forest stroke-2 hover:r-6 hover:fill-forest transition-all" />
              {/* Tooltip */}
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                className="fill-charcoal font-bold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {p.val}
              </text>
              {/* Date Label */}
              <text x={p.x} y={height - padding + 15} textAnchor="middle" className="fill-charcoal/60 select-none">
                {formattedDates[idx]}
              </text>
            </g>
          ))}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1E201E" strokeWidth="1.5" />
        </svg>
      );
    }
  };

  const renderErrorBanner = () => {
    const activeError = error || syncWarning;
    if (!activeError) return null;

    const isGoogleFitDisabled = activeError.includes('fitness.googleapis.com') || activeError.includes('Fitness API has not been used') || activeError.includes('is disabled') || activeError.includes('403');
    
    let linkUrl = '';
    const match = activeError.match(/(https:\/\/console\.developers\.google\.com[^\s]+)/);
    if (match) {
      linkUrl = match[0];
    } else {
      linkUrl = 'https://console.cloud.google.com/apis/library/fitness.googleapis.com';
    }

    return (
      <div className="border border-terracotta p-5 bg-terracotta/5 text-terracotta space-y-2 animate-fadeIn">
        <div className="text-xs uppercase font-bold tracking-wider">[ SYSTEM INTEGRATION ERROR ]</div>
        <p className="text-sm font-sans leading-relaxed">
          {isGoogleFitDisabled ? (
            <span>
              The Google Fit API (Fitness API) has not been enabled in your Google Cloud project. To sync real data, click the button below to enable the Fitness API in your Google Developer Console, wait a few minutes for propagation, and then try syncing again.
            </span>
          ) : (
            <span>{activeError}</span>
          )}
        </p>
        {isGoogleFitDisabled && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs uppercase font-black tracking-wider border border-terracotta bg-terracotta/10 px-4 py-2 hover:bg-terracotta hover:text-alabaster transition-colors mt-2"
          >
            Enable Fitness API in Google Console &rarr;
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Title & Tagline Header */}
      <div className="border border-charcoal p-6 md:p-8 bg-alabaster flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest">[ PHYSIOLOGICAL MODULE ]</span>
          <h2 className="text-3xl font-serif mt-1 font-semibold">Health Intelligence</h2>
          <p className="text-sm text-charcoal/70 mt-1 font-sans italic font-serif">
            Understand your body. Improve your life.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowLogModal(true)}
            className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-4 py-2 text-xs uppercase font-bold tracking-wider transition-colors"
          >
            + Log Metrics
          </button>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleInitiateOAuth}
              className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-4 py-2 text-xs uppercase font-bold tracking-wider transition-colors inline-block"
            >
              Link Google (Real Fit)
            </button>
            <button
              onClick={() => handleSync('real')}
              disabled={syncing}
              className="border border-charcoal hover:border-forest text-charcoal hover:text-forest px-4 py-2 text-xs uppercase font-bold tracking-wider transition-colors"
            >
              {syncing ? 'Syncing...' : 'Sync Real Fit'}
            </button>
          </div>
        </div>
      </div>

      {renderErrorBanner()}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hero Score Card (5 Cols) */}
        <div className="lg:col-span-5 border border-charcoal p-6 bg-alabaster flex flex-col justify-between h-full min-h-[300px]">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-2">
              [ BIOMETRIC INDEX ]
            </span>
            <div className="flex justify-between items-baseline mb-4">
              <h3 className="text-xl font-serif font-bold">Health Score</h3>
              <span className="text-xs font-bold uppercase text-forest tracking-wider">
                {dashboardData?.scoreRating}
              </span>
            </div>
            
            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-7xl font-serif font-black text-charcoal">{score}</span>
              <span className="text-xl font-serif text-charcoal/40">/ 100</span>
              <span className="text-sm font-bold text-forest ml-auto">{dashboardData?.scoreDiff}</span>
            </div>
          </div>

          <div className="border-t border-charcoal/20 pt-4 space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-2">
              Target Indicators
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-sans">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 border flex items-center justify-center font-bold text-[10px] ${components.sleep ? 'border-forest bg-forest/5 text-forest' : 'border-charcoal/30 text-transparent'}`}>✓</span>
                <span className="text-charcoal/80">Sleep Duration</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 border flex items-center justify-center font-bold text-[10px] ${components.activity ? 'border-forest bg-forest/5 text-forest' : 'border-charcoal/30 text-transparent'}`}>✓</span>
                <span className="text-charcoal/80">Daily Step Target</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 border flex items-center justify-center font-bold text-[10px] ${components.heartRate ? 'border-forest bg-forest/5 text-forest' : 'border-charcoal/30 text-transparent'}`}>✓</span>
                <span className="text-charcoal/80">Optimal Heart Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 border flex items-center justify-center font-bold text-[10px] ${components.exercise ? 'border-forest bg-forest/5 text-forest' : 'border-charcoal/30 text-transparent'}`}>✓</span>
                <span className="text-charcoal/80">Workout Synced</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 border flex items-center justify-center font-bold text-[10px] ${components.water ? 'border-forest bg-forest/5 text-forest' : 'border-charcoal/30 text-transparent'}`}>✓</span>
                <span className="text-charcoal/80">Hydration Threshold</span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Summary Matrix (7 Cols) */}
        <div className="lg:col-span-7 border border-charcoal p-6 bg-alabaster flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-4">
              [ QUANTITATIVE LOGS ]
            </span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="border-l border-charcoal/20 pl-4 py-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60">Steps</span>
                <h4 className="text-2xl font-serif font-bold mt-1 text-charcoal">
                  {(summary.steps?.current || 0).toLocaleString()}
                </h4>
                <span className="text-[10px] text-charcoal/50">/ {summary.steps?.target.toLocaleString()} steps</span>
              </div>
              
              <div className="border-l border-charcoal/20 pl-4 py-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60">Sleep</span>
                <h4 className="text-2xl font-serif font-bold mt-1 text-charcoal">
                  {Math.floor((summary.sleep?.current || 0) / 60)}h {Math.round((summary.sleep?.current || 0) % 60)}m
                </h4>
                <span className="text-[10px] text-charcoal/50">/ 7.5 hrs target</span>
              </div>

              <div className="border-l border-charcoal/20 pl-4 py-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60">Heart Rate</span>
                <h4 className="text-2xl font-serif font-bold mt-1 text-charcoal">
                  {summary.heartRate || '--'} <span className="text-xs">bpm</span>
                </h4>
                <span className="text-[10px] text-charcoal/50">Resting average</span>
              </div>

              <div className="border-l border-charcoal/20 pl-4 py-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60">Calories Burned</span>
                <h4 className="text-2xl font-serif font-bold mt-1 text-charcoal">
                  {(summary.calories || 0).toLocaleString()} <span className="text-xs">kcal</span>
                </h4>
                <span className="text-[10px] text-charcoal/50">Daily metabolic + active</span>
              </div>

              <div className="border-l border-charcoal/20 pl-4 py-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60">Water Intake</span>
                <h4 className="text-2xl font-serif font-bold mt-1 text-charcoal">
                  {(summary.water || 0).toFixed(1)} <span className="text-xs">L</span>
                </h4>
                <span className="text-[10px] text-charcoal/50">/ 3.0 Litres goal</span>
              </div>

              <div className="border-l border-charcoal/20 pl-4 py-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60">Workout</span>
                <h4 className="text-2xl font-serif font-bold mt-1 text-charcoal">
                  {summary.workout || 0} <span className="text-xs">mins</span>
                </h4>
                <span className="text-[10px] text-charcoal/50">Cardiovascular exercise</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-charcoal/10 flex justify-between items-center text-xs text-charcoal/60">
            <span>Height: {profile.height || 180}cm &bull; Current Weight: {profile.weight || 80}kg</span>
            <span>Blood Group: {profile.bloodType || 'O+'}</span>
          </div>
        </div>
      </div>

      {/* Charts & Interactive Trends Section */}
      <div className="border border-charcoal p-6 bg-alabaster">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-charcoal/20 pb-4 mb-6 gap-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50">[ TELEMETRY WAVEFORM ]</span>
            <h3 className="text-xl font-serif font-bold mt-1">Biometric Trends</h3>
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'steps', label: 'Activity/Steps' },
              { id: 'sleep', label: 'Sleep Quality' },
              { id: 'heartRate', label: 'Pulse/Heart Rate' },
              { id: 'weight', label: 'Mass/Weight' },
              { id: 'water', label: 'Hydration' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveChart(tab.id)}
                className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider border transition-colors ${
                  activeChart === tab.id
                    ? 'bg-charcoal text-alabaster border-charcoal'
                    : 'border-charcoal/25 text-charcoal/60 hover:border-charcoal hover:text-charcoal'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Render Container */}
        <div className="h-64 md:h-80 w-full flex justify-center items-center">
          {renderSVGChart()}
        </div>
      </div>

      {/* Mid Grid: Hydration & Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hydration Circular Logger */}
        <div className="border border-charcoal p-6 bg-alabaster flex flex-col justify-between min-h-[300px]">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-2">[ LIQUID LEDGER ]</span>
            <h3 className="text-xl font-serif font-bold">Hydration Log</h3>
            <p className="text-xs text-charcoal/60 font-sans mt-1">Monitor water intake to maintain cellular balance.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-6">
            {/* Animated SVG circular ring */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r="60" className="stroke-charcoal/10" strokeWidth="8" fill="transparent" />
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  className="stroke-forest transition-all duration-500"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={377}
                  strokeDashoffset={377 - (377 * Math.min(100, ((summary.water || 0) / 3.0) * 100)) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-serif font-black text-charcoal">
                  {Math.round(((summary.water || 0) / 3.0) * 100)}%
                </span>
                <span className="text-[9px] uppercase tracking-wider font-bold text-charcoal/60">of target</span>
              </div>
            </div>

            <div className="space-y-3 w-full sm:w-auto">
              <div className="text-center sm:text-left">
                <span className="text-3xl font-serif font-bold text-charcoal">{(summary.water || 0).toFixed(1)} L</span>
                <span className="text-xs text-charcoal/40 font-serif ml-1">/ 3.0 L</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleLogWater(250)}
                  className="border border-charcoal hover:border-forest text-[10px] uppercase font-bold tracking-wider py-2 px-3 text-charcoal hover:text-forest transition-colors"
                >
                  +250ml
                </button>
                <button
                  onClick={() => handleLogWater(500)}
                  className="border border-charcoal hover:border-forest text-[10px] uppercase font-bold tracking-wider py-2 px-3 text-charcoal hover:text-forest transition-colors"
                >
                  +500ml
                </button>
                <button
                  onClick={() => handleLogWater(1000)}
                  className="border border-charcoal hover:border-forest text-[10px] uppercase font-bold tracking-wider py-2 px-3 text-charcoal hover:text-forest transition-colors"
                >
                  +1L
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action recommendations checklist */}
        <div className="border border-charcoal p-6 bg-alabaster flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-2">[ STRATEGIC INTERVENTION ]</span>
            <h3 className="text-xl font-serif font-bold">Smart Recommendations</h3>
            <p className="text-xs text-charcoal/60 font-sans mt-1">Algorithmic suggestions computed from physiological analysis.</p>
          </div>

          <div className="my-6 space-y-4">
            {recommendations.length === 0 ? (
              <p className="text-xs font-serif italic text-charcoal/40">Calculating physiological variances...</p>
            ) : (
              recommendations.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 border-b border-charcoal/10 pb-3 last:border-0 last:pb-0">
                  <span className="text-forest text-sm select-none font-bold mt-0.5">&rarr;</span>
                  <div className="flex-1">
                    <p className="text-xs font-sans font-bold text-charcoal">{rec.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Central Piece: AI Coach and Insights */}
      <div className="border border-charcoal p-6 md:p-8 bg-alabaster">
        <div className="flex justify-between items-start border-b border-charcoal pb-4 mb-6">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-forest">[ LOGIC ENGINE ]</span>
            <h2 className="text-2xl font-serif mt-1 font-semibold">AI Health Coach</h2>
            <p className="text-xs text-charcoal/70 mt-1 font-sans">
              Personalized physical reflections generated via cognitive biometric comparison.
            </p>
          </div>
          <button
            onClick={handleRefreshInsights}
            className="text-xs uppercase font-bold tracking-wider text-forest hover:text-charcoal border border-forest/30 hover:border-charcoal px-3 py-1.5 transition-colors bg-forest/5"
          >
            Compute Insights
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {insights.map((ins, idx) => (
            <div key={ins.id || idx} className="border border-charcoal/30 p-5 bg-alabaster hover:border-forest transition-colors flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-forest block mb-3">
                  [ {ins.category?.toUpperCase() || 'GENERAL'} INSIGHT ]
                </span>
                <p className="font-serif text-sm leading-relaxed text-charcoal italic">
                  &ldquo;{ins.text}&rdquo;
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid: Medical PDF reports & Medicine Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medicine Manager Card */}
        <div className="border border-charcoal p-6 bg-alabaster">
          <div className="flex justify-between items-start border-b border-charcoal/20 pb-4 mb-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block">[ THERAPEUTIC REGIMEN ]</span>
              <h3 className="text-xl font-serif font-bold mt-1">Medicine Manager</h3>
            </div>
            <button
              onClick={() => setShowMedForm(!showMedForm)}
              className="text-xs uppercase font-bold tracking-wider text-charcoal/60 hover:text-charcoal border border-charcoal/20 hover:border-charcoal px-2.5 py-1 transition-all"
            >
              {showMedForm ? 'Cancel' : '+ Add Med'}
            </button>
          </div>

          {showMedForm && (
            <form onSubmit={handleAddMed} className="mb-6 p-4 border border-dashed border-charcoal/40 bg-alabaster/30 space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Medication Name</label>
                  <input
                    type="text"
                    required
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="e.g. Lisinopril"
                    className="w-full bg-alabaster border border-charcoal p-2 text-xs focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Dosage</label>
                  <input
                    type="text"
                    required
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    placeholder="e.g. 10mg"
                    className="w-full bg-alabaster border border-charcoal p-2 text-xs focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Frequency</label>
                  <select
                    value={medFreq}
                    onChange={(e) => setMedFreq(e.target.value)}
                    className="w-full bg-alabaster border border-charcoal p-2 text-xs focus:outline-none focus:ring-1 focus:ring-forest"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Twice Daily">Twice Daily</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Dose Count (Refill)</label>
                  <input
                    type="number"
                    value={medRefillCount}
                    onChange={(e) => setMedRefillCount(e.target.value)}
                    className="w-full bg-alabaster border border-charcoal p-2 text-xs focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableRefill"
                  checked={medRefill}
                  onChange={(e) => setMedRefill(e.target.checked)}
                  className="rounded border-charcoal text-forest focus:ring-forest"
                />
                <label htmlFor="enableRefill" className="text-[10px] uppercase font-bold text-charcoal/60">Enable Refill Reminders</label>
              </div>
              <button
                type="submit"
                className="w-full bg-forest text-alabaster text-xs font-bold uppercase tracking-wider py-2 border border-forest hover:bg-charcoal hover:border-charcoal transition-colors"
              >
                Save Medication
              </button>
            </form>
          )}

          <div className="space-y-4">
            {medications.length === 0 ? (
              <p className="text-xs font-serif italic text-charcoal/40">No therapeutic interventions set.</p>
            ) : (
              medications.map((med) => {
                const takenToday = med.history && med.history[todayStr] === true;
                const lowSupply = med.refillReminder && (med.refillCount <= 7);
                return (
                  <div key={med.id} className="border border-charcoal/20 p-4 bg-alabaster flex justify-between items-center hover:border-charcoal transition-all">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <h4 className="text-sm font-bold">{med.name}</h4>
                        <span className="text-[10px] text-charcoal/50">({med.dosage})</span>
                      </div>
                      <p className="text-[10px] text-charcoal/60 uppercase tracking-wider mt-1">Schedule: {med.frequency}</p>
                      {med.refillReminder && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 border ${lowSupply ? 'border-terracotta text-terracotta bg-terracotta/5' : 'border-charcoal/20 text-charcoal/50'}`}>
                            Stock: {med.refillCount} doses left
                          </span>
                          {lowSupply && (
                            <button
                              onClick={() => handleMedRefill(med.id)}
                              className="text-[9px] uppercase font-extrabold text-terracotta hover:underline"
                            >
                              Refill supply (+30)
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleMedToggle(med.id, takenToday)}
                      className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider border transition-colors flex items-center gap-1.5 ${
                        takenToday
                          ? 'border-forest bg-forest/5 text-forest font-black'
                          : 'border-charcoal/30 text-charcoal/50 hover:border-charcoal hover:text-charcoal'
                      }`}
                    >
                      <span>{takenToday ? '✓ Dose Taken' : 'Mark Taken'}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Medical Document Analysis Card */}
        <div className="border border-charcoal p-6 bg-alabaster">
          <div className="border-b border-charcoal/20 pb-4 mb-4">
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block">[ MULTIMODAL EXTRACTION ]</span>
            <h3 className="text-xl font-serif font-bold mt-1">Medical Reports OCR</h3>
          </div>

          <div className="space-y-4">
            {/* File Upload Zone */}
            <div className="border border-dashed border-charcoal/30 p-4 bg-alabaster/30 text-center relative group hover:border-forest transition-colors">
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp, application/pdf"
                ref={fileInputRef}
                onChange={handleReportFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={reportLoading}
              />
              {reportFile ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-forest font-serif italic text-sm truncate max-w-[250px]">{reportFile.name}</span>
                  <span className="text-[9px] uppercase tracking-wider text-charcoal/40">
                    {(reportFile.size / 1024 / 1024).toFixed(2)} MB &bull; Loaded
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-charcoal/60 group-hover:text-forest transition-colors">
                  <span className="text-xl">&uarr;</span>
                  <span className="font-sans text-xs font-bold uppercase tracking-wider">Drag & Drop or Click to Browse</span>
                  <span className="text-[9px] uppercase tracking-wider text-charcoal/40">JPG, PNG, WebP, PDF</span>
                </div>
              )}
            </div>

            {reportFile && !reportResult && (
              <div className="flex justify-between items-center">
                <button
                  onClick={handleReportAnalyze}
                  disabled={reportLoading || !reportBase64}
                  className="bg-forest text-alabaster font-sans px-4 py-2 uppercase text-[10px] font-bold tracking-wider hover:bg-charcoal transition-colors border border-forest disabled:opacity-50"
                >
                  {reportLoading ? 'ANALYZING MEDICAL DATA...' : 'INITIATE EXTRACTION'}
                </button>
                <button
                  type="button"
                  onClick={handleClearReport}
                  className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 hover:text-charcoal"
                >
                  Clear File
                </button>
              </div>
            )}

            {reportLoading && (
              <div className="border border-dashed border-charcoal p-6 text-center animate-pulse">
                <div className="font-serif italic text-sm text-charcoal/80 mb-1">Scanning lab sheets & biomarkers...</div>
                <div className="text-[9px] uppercase tracking-widest text-charcoal/40 font-mono">Routing structure to Orbit intelligence core</div>
              </div>
            )}

            {reportError && (
              <div className="border border-terracotta p-3 bg-terracotta/5 text-terracotta text-xs font-sans">
                {reportError}
              </div>
            )}

            {/* Results Display */}
            {reportResult && !reportLoading && (
              <div className="space-y-4 animate-fadeIn border-t border-charcoal/10 pt-4">
                <div className="border border-charcoal/30 p-4 bg-alabaster/40">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-forest block">
                      [ EXTRACTION REPORT ]
                    </span>
                    <button
                      onClick={handleClearReport}
                      className="text-[10px] uppercase font-bold text-charcoal/50 hover:text-charcoal"
                    >
                      Close Report
                    </button>
                  </div>
                  <p className="font-serif text-xs leading-relaxed text-charcoal italic">
                    &ldquo;{reportResult.summary}&rdquo;
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reportResult.keyValues && reportResult.keyValues.length > 0 && (
                    <div className="border border-charcoal/30 p-4 bg-alabaster/40">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-charcoal/60 block mb-2">
                        [ BIOMARKER VALUES ]
                      </span>
                      <ul className="space-y-1.5 text-xs text-charcoal/80 font-sans">
                        {reportResult.keyValues.map((val, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-forest select-none font-bold">&bull;</span>
                            <span>{val}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reportResult.abnormalValues && reportResult.abnormalValues.length > 0 && (
                    <div className="border border-charcoal/30 p-4 bg-alabaster/40">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-terracotta block mb-2">
                        [ ABNORMAL HIGHLIGHTS ]
                      </span>
                      <ul className="space-y-1.5 text-xs text-terracotta font-sans font-bold">
                        {reportResult.abnormalValues.map((val, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-terracotta select-none font-bold">&bull;</span>
                            <span>{val}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {reportResult.doctorQuestions && reportResult.doctorQuestions.length > 0 && (
                  <div className="border border-charcoal/30 p-4 bg-alabaster/40">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-charcoal/60 block mb-2">
                      [ QUESTIONS FOR YOUR DOCTOR ]
                    </span>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-charcoal/80 font-sans">
                      {reportResult.doctorQuestions.map((q, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {q}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="border border-charcoal p-6 bg-alabaster">
        <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-4">[ CHRONOLOGICAL LEDGER ]</span>
        <h3 className="text-xl font-serif font-bold mb-4">Today's Health Timeline</h3>
        <div className="space-y-3">
          {timeline.slice(0, 10).map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 border-b border-charcoal/10 pb-2 last:border-0 last:pb-0">
              <span className="text-[10px] border border-charcoal/30 px-1.5 py-0.5 font-sans text-charcoal/60 whitespace-nowrap bg-charcoal/5">
                {item.time}
              </span>
              <p className="text-xs font-sans text-charcoal/80">{item.text}</p>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-forest/80 ml-auto bg-forest/5 border border-forest/10 px-1">
                {item.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Entry Modal Dialog */}
      {showLogModal && (
        <div className="fixed inset-0 bg-charcoal/70 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fadeIn">
          <div className="border border-charcoal bg-alabaster max-w-md w-full p-6 md:p-8 space-y-6">
            <div className="border-b border-charcoal pb-3 flex justify-between items-baseline">
              <h3 className="text-xl font-serif font-bold">Manual Health Log</h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-xs uppercase font-bold text-charcoal/50 hover:text-charcoal flex items-center gap-1 hover:-translate-y-0.5 transition-transform"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Body Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={logWeight}
                  onChange={(e) => setLogWeight(e.target.value)}
                  placeholder="e.g. 79.5"
                  className="w-full bg-alabaster border border-charcoal p-2 text-sm focus:outline-none focus:ring-1 focus:ring-forest"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={logBP}
                    onChange={(e) => setLogBP(e.target.value)}
                    placeholder="e.g. 120/80"
                    className="w-full bg-alabaster border border-charcoal p-2 text-sm focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Blood Sugar (mg/dL)</label>
                  <input
                    type="number"
                    value={logBS}
                    onChange={(e) => setLogBS(e.target.value)}
                    placeholder="e.g. 95"
                    className="w-full bg-alabaster border border-charcoal p-2 text-sm focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-charcoal/60 mb-1">Current Mood State</label>
                <select
                  value={logMood}
                  onChange={(e) => setLogMood(e.target.value)}
                  className="w-full bg-alabaster border border-charcoal p-2 text-sm focus:outline-none focus:ring-1 focus:ring-forest"
                >
                  <option value="Energetic">Energetic & Vital</option>
                  <option value="Calm">Calm & Balanced</option>
                  <option value="Tired">Tired / Low Energy</option>
                  <option value="Stressed">Stressed / Anxious</option>
                  <option value="Restless">Restless</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submittingLog || (!logWeight && !logBP && !logBS && !logMood)}
                className="w-full bg-forest text-alabaster font-sans px-6 py-2.5 uppercase text-xs font-bold tracking-wider hover:bg-charcoal transition-colors border border-forest disabled:opacity-50"
              >
                {submittingLog ? 'RECORDING TELEMETRY...' : 'LOG HEALTH VALUES'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
