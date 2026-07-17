import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageSquare, 
  Link2, 
  Camera, 
  ShieldAlert, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  PhoneCall, 
  History, 
  Sparkles, 
  RefreshCw,
  FileText,
  AlertCircle,
  Check,
  Search,
  BookOpen,
  ArrowRight
} from 'lucide-react';

const BACKEND = 'http://localhost:5001';

const RISK_BADGES = {
  'HIGH RISK':  { text: 'HIGH THREAT', icon: AlertOctagon, color: 'text-terracotta border-terracotta bg-terracotta/5' },
  'SUSPICIOUS': { text: 'SUSPICIOUS', icon: AlertTriangle, color: 'text-amber-600 border-amber-500 bg-amber-500/5' },
  'CAUTION':    { text: 'CAUTION',    icon: AlertTriangle, color: 'text-amber-500 border-amber-400 bg-amber-400/5' },
  'LOW RISK':   { text: 'LOW RISK',   icon: CheckCircle2, color: 'text-forest border-forest bg-forest/5' }
};

const SCAM_TEMPLATES = [
  { label: 'KYC Block Alert', text: 'State Bank of India Alert: Your account is suspended due to expired KYC status. Click here immediately to verify: sbi-secure-kyc.com' },
  { label: 'Lottery Prize Win', text: 'Dear customer, you have won a cash lottery worth ₹25,00,000! Pay ₹3,000 claims fee to process. Contact India Post Support.' },
  { label: 'Courier Hold Alert', text: 'India Post Courier alert: Your package is held at our warehouse due to incomplete delivery address. Pay ₹25 address update fee at indiapost-address.com' },
  { label: 'Electricity Disconnect', text: 'Urgent: Your electricity connection will be disconnected tonight due to unpaid dues. Contact MSEB Officer immediately at 98765-43210.' },
  { label: 'Passport Expiration Check', text: 'Urgent notice: Your Indian Passport has expired. Click here to pay ₹1,500 and renew within 24 hours to avoid suspension.' }
];

export default function ScamDetector() {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'url' | 'screenshot' | 'qr' | 'history'
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState('');
  const [screenshotMime, setScreenshotMime] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  
  // Scanning state
  const [loading, setLoading] = useState(false);
  const [radarStep, setRadarStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // History list
  const [history, setHistory] = useState([]);
  const [overallScore, setOverallScore] = useState(98);
  const [historyLoading, setHistoryLoading] = useState(false);

  const radarIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BACKEND}/scam/history`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data.scams || []);
      setOverallScore(data.overallScore || 98);
    } catch { /* non-fatal */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSelectTemplate = (text) => {
    setInputText(text);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScreenshotName(file.name);
    setScreenshotMime(file.type);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      setScreenshotBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  // Run Radar sweep animation and trigger endpoint
  const handleAnalyze = async (payload) => {
    setLoading(true);
    setError('');
    setResult(null);
    setRadarStep(0);

    // Radar step animation
    radarIntervalRef.current = setInterval(() => {
      setRadarStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 800);

    try {
      const res = await fetch(`${BACKEND}/scam/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Scan failed (${res.status})`);
      }

      const data = await res.json();
      
      // Keep loader visible for visual suspense
      setTimeout(async () => {
        clearInterval(radarIntervalRef.current);
        setResult(data);
        setLoading(false);
        await fetchHistory();
      }, 3500);

    } catch (err) {
      clearInterval(radarIntervalRef.current);
      setError(err.message || 'Threat scan failed.');
      setLoading(false);
    }
  };

  const triggerTextScan = () => {
    if (!inputText.trim()) return;
    handleAnalyze({ type: 'text', text: inputText });
  };

  const triggerUrlScan = () => {
    if (!inputUrl.trim()) return;
    handleAnalyze({ type: 'url', text: inputUrl });
  };

  const triggerScreenshotScan = () => {
    if (!screenshotBase64) return;
    handleAnalyze({
      type: 'screenshot',
      base64: screenshotBase64,
      mimeType: screenshotMime,
      text: `[Vision Screenshot Analyze: ${screenshotName}]`
    });
  };

  const handleCopyWarning = () => {
    if (!result) return;
    const warningText = `[Orbit Scam Shield Alert]
Suspect: ${inputText || inputUrl || 'Attached Screenshot'}
Threat level: ${result.riskLevel} (${result.score}% Scam Probability)
Reasons flagged:
${(result.indicators || []).map(i => `- ${i.text}`).join('\n')}
Orbit Advice: DO NOT click links, respond, or make payments.`;

    navigator.clipboard.writeText(warningText);
    alert('Scam advisory copied to clipboard!');
  };

  const handleSearchOfficial = (brandName) => {
    const query = encodeURIComponent(`${brandName || 'organization'} official customer care helpline contact`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  const handleReset = () => {
    setInputText('');
    setInputUrl('');
    setScreenshotBase64('');
    setScreenshotMime('');
    setScreenshotName('');
    setResult(null);
    setError('');
  };

  const badgeMeta = result ? (RISK_BADGES[result.riskLevel] || RISK_BADGES['LOW RISK']) : null;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── MODULE HEADER ── */}
      <div className="border border-charcoal p-6 md:p-8 bg-alabaster flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-2">[ SECURITY CORE MODULE ]</span>
          <h2 className="text-4xl font-serif font-black leading-none tracking-tight">Scam Shield</h2>
          <p className="text-sm text-charcoal/60 font-sans mt-2 max-w-lg leading-relaxed">
            Protect your assets. Scan suspicious SMS, verify sketchy redirect URLs, analyze chat screenshots, or decode payment QR codes.
          </p>
        </div>
        <div className="border border-charcoal bg-alabaster p-4 text-center shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 block mb-1">Your Shield Score</span>
          <span className={`text-2xl font-serif font-bold ${overallScore >= 80 ? 'text-forest' : 'text-terracotta'}`}>
            {overallScore} / 100
          </span>
        </div>
      </div>

      {/* ── INPUT TABS ── */}
      <div className="border border-charcoal bg-alabaster p-1 flex gap-1 overflow-x-auto">
        {[
          { id: 'text', label: 'Message Scan', icon: MessageSquare },
          { id: 'url', label: 'Link Checker', icon: Link2 },
          { id: 'screenshot', label: 'Screenshot Scanner', icon: Camera },
          { id: 'history', label: 'Threat Ledger', icon: ShieldAlert }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setResult(null); setError(''); }}
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

      {/* ── MODULE BODY ── */}
      <div className="border border-charcoal p-5 md:p-7 bg-alabaster">
        
        {/* VIEW: MESSAGE SCAN */}
        {activeTab === 'text' && !loading && !result && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-charcoal/60 mb-3">[ PASTE SUSPICIOUS COMMUNICATIONS ]</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={5}
                placeholder="e.g. 'Congratulations! You won ₹25,00,000. Pay ₹5,000 claim fee to redeem. Click sbi-claims-verify.com'"
                className="w-full bg-alabaster border border-charcoal/40 p-3 font-serif text-base text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-charcoal resize-none animate-fadeIn"
              />
            </div>
            
            <div className="flex justify-between items-center">
              <button
                onClick={triggerTextScan}
                disabled={!inputText.trim()}
                className="bg-charcoal text-alabaster font-sans px-6 py-2.5 uppercase text-xs font-black tracking-widest hover:bg-forest transition-colors border border-charcoal shadow-[3px_3px_0px_0px_rgba(30,32,30,1)] disabled:opacity-40"
              >
                Scan Threat Signatures
              </button>
              {inputText && (
                <button onClick={handleReset} className="text-xs uppercase font-bold text-charcoal/40">Clear</button>
              )}
            </div>

            {/* QUICK TEMPLATES */}
            <div className="border-t border-charcoal/10 pt-4 mt-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/40 block mb-2">Simulate Scam Templates</span>
              <div className="flex flex-wrap gap-2">
                {SCAM_TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => handleSelectTemplate(t.text)}
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-charcoal/20 hover:border-charcoal bg-alabaster text-charcoal/60 hover:text-charcoal transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: LINK CHECKER */}
        {activeTab === 'url' && !loading && !result && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-charcoal/60 mb-2">[ ENTER LINK TO CHECK ]</label>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="e.g. http://sbi-secure-kyc-verification.com"
                className="w-full bg-alabaster border border-charcoal/40 p-3 font-mono text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-charcoal"
              />
            </div>
            
            <div className="flex justify-between items-center">
              <button
                onClick={triggerUrlScan}
                disabled={!inputUrl.trim()}
                className="bg-charcoal text-alabaster font-sans px-6 py-2.5 uppercase text-xs font-black tracking-widest hover:bg-forest transition-colors border border-charcoal shadow-[3px_3px_0px_0px_rgba(30,32,30,1)] disabled:opacity-40"
              >
                Scan Domain Risks
              </button>
              {inputUrl && (
                <button onClick={handleReset} className="text-xs uppercase font-bold text-charcoal/40">Clear</button>
              )}
            </div>
          </div>
        )}

        {/* VIEW: SCREENSHOT SCANNER */}
        {activeTab === 'screenshot' && !loading && !result && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-charcoal/60 mb-3">[ ATTACH SCREENSHOT FOR OCR ]</label>
              
              {screenshotBase64 ? (
                <div className="border border-charcoal p-4 flex flex-col items-center justify-center bg-alabaster relative">
                  <button
                    onClick={() => { setScreenshotBase64(''); setScreenshotName(''); }}
                    className="absolute top-2 right-2 text-xs uppercase font-bold text-terracotta border border-terracotta/30 px-2 py-0.5"
                  >
                    Remove File
                  </button>
                  <img
                    src={`data:${screenshotMime};base64,${screenshotBase64}`}
                    alt="Preview"
                    className="max-h-48 border border-charcoal/20 shadow-sm mb-3 object-contain"
                  />
                  <span className="text-xs font-sans text-charcoal/60 font-semibold">{screenshotName}</span>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-charcoal/30 hover:border-charcoal p-8 text-center cursor-pointer bg-charcoal/5 hover:bg-charcoal/10 transition-all flex flex-col items-center justify-center min-h-[160px]"
                >
                  <Camera className="w-8 h-8 text-charcoal/50 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Upload Screenshot File</span>
                  <span className="text-[10px] text-charcoal/40 font-sans mt-1">PNG, JPG up to 5MB. Parses message, QR, or links.</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={triggerScreenshotScan}
                disabled={!screenshotBase64}
                className="bg-charcoal text-alabaster font-sans px-6 py-2.5 uppercase text-xs font-black tracking-widest hover:bg-forest transition-colors border border-charcoal shadow-[3px_3px_0px_0px_rgba(30,32,30,1)] disabled:opacity-40"
              >
                Scan Image Signature
              </button>
            </div>
          </div>
        )}

        {/* RADAR SWEEP ANIMATION CONTAINER */}
        {loading && (
          <div className="border border-charcoal p-8 text-center bg-alabaster relative overflow-hidden animate-fadeIn">
            {/* Moving Radar Sweep gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-forest/5 to-transparent -translate-x-full animate-marquee-left" style={{ animationDuration: '2s' }} />
            
            <div className="w-16 h-16 rounded-full border border-forest/30 flex items-center justify-center mx-auto mb-4 relative animate-pulse">
              <ShieldAlert className="w-8 h-8 text-charcoal/80" />
            </div>
            
            <div className="font-serif italic text-lg text-charcoal font-semibold mb-3">
              Orbit Scam Shield Radar Analyzing...
            </div>
            
            <div className="space-y-2.5 max-w-xs mx-auto text-left border-l border-charcoal/20 pl-4">
              {[
                { step: 1, label: '1. Urgent pattern checks' },
                { step: 2, label: '2. Cross-domain contradicts' },
                { step: 3, label: '3. Spoofing domain search' },
                { step: 4, label: '4. Risk level computation' }
              ].map(s => {
                const done = radarStep >= s.step;
                const active = radarStep === s.step - 1;
                return (
                  <div key={s.step} className={`text-[10px] uppercase font-bold tracking-wider flex justify-between items-center transition-all ${
                    done ? 'text-forest' : active ? 'text-charcoal animate-pulse' : 'text-charcoal/30'
                  }`}>
                    <span>{s.label}</span>
                    <span className="flex items-center gap-1">
                      {done ? <Check className="w-3.5 h-3.5 stroke-[3px]" /> : active ? <RefreshCw className="w-3 h-3 animate-spin" /> : ''}
                      <span>{done ? 'Complete' : active ? 'Scanning...' : 'Waiting...'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && !loading && (
          <div className="border border-terracotta p-5 bg-terracotta/5 text-terracotta">
            <span className="text-xs uppercase font-bold tracking-wider block mb-1">[ CONFLICT ENCOUNTERED ]</span>
            <p className="text-sm font-sans">{error}</p>
          </div>
        )}

        {/* DETECTED SCAM RESULT */}
        {result && !loading && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Top Threat Badge */}
            <div className={`border p-6 ${badgeMeta?.color}`}>
              <div className="flex justify-between items-start flex-col sm:flex-row gap-2 border-b border-charcoal/15 pb-4 mb-4">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider border border-current px-2 py-1 flex items-center gap-1.5 w-fit">
                    {badgeMeta && React.createElement(badgeMeta.icon, { className: "w-3.5 h-3.5 stroke-[2.5px]" })}
                    <span>{badgeMeta?.text}</span>
                  </span>
                  <span className="text-xs uppercase tracking-wider text-charcoal/50 block mt-3.5 font-bold">
                    Scam Category: {result.category || 'General Communication'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-serif font-black">{result.score || 0}%</div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-charcoal/40 block mt-1">Scam Probability</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-charcoal/10 border border-charcoal/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current transition-all duration-700"
                  style={{ width: `${result.score || 0}%` }}
                />
              </div>

              {/* Summary Paragraph */}
              <p className="font-serif italic text-sm leading-relaxed text-charcoal mt-5">
                "{result.summary}"
              </p>
            </div>

            {/* Contradiction Banner Block (WOW Feature) */}
            {result.contradictions?.length > 0 && (
              <div className="border border-terracotta p-5 bg-terracotta/5 shadow-[3px_3px_0px_0px_rgba(209,73,73,0.15)]">
                <span className="text-xs uppercase font-bold tracking-wider text-terracotta flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>PROFILE CONTRADICTION DETECTED</span>
                </span>
                <div className="space-y-2">
                  {result.contradictions.map((c, idx) => (
                    <p key={idx} className="text-xs font-sans text-charcoal/80 leading-relaxed">
                      <strong>[{c.source}]</strong>: {c.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Scam Pattern Memory Match */}
            {result.isMemoryMatch && (
              <div className="border border-charcoal p-4 bg-charcoal/5 text-xs text-charcoal/60 font-sans italic flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-charcoal/60 shrink-0" />
                <span>This text matches a recurring scam pattern previously scan-logged in your history.</span>
              </div>
            )}

            {/* Signals and actions grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Threat Indicators */}
              <div className="border border-charcoal p-5 bg-alabaster">
                <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ THREAT INDICATORS ]</span>
                {result.indicators?.length === 0 ? (
                  <p className="text-xs text-charcoal/40 italic">No suspicious indicators detected.</p>
                ) : (
                  <ul className="space-y-3">
                    {(result.indicators || []).map((ind, i) => (
                      <li key={i} className="text-xs font-sans flex items-start gap-2 text-charcoal/70 animate-fadeIn" style={{ animationDelay: `${i * 0.05}s` }}>
                        <AlertTriangle className="w-3.5 h-3.5 text-terracotta mt-0.5 shrink-0" />
                        <span>{ind.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Action protocols */}
              <div className="border border-charcoal p-5 bg-alabaster">
                <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ PROTECTIVE PROTOCOLS ]</span>
                <ul className="space-y-3">
                  {(result.actions || []).map((act, i) => (
                    <li key={i} className="text-xs font-sans flex items-start gap-2 text-forest animate-fadeIn" style={{ animationDelay: `${i * 0.05}s` }}>
                      <ArrowRight className="w-3.5 h-3.5 text-forest mt-0.5 shrink-0" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex gap-2 flex-wrap border-t border-charcoal/10 pt-4">
              <button
                onClick={handleCopyWarning}
                className="text-xs font-bold uppercase tracking-wider border border-charcoal px-4 py-2 hover:bg-charcoal hover:text-alabaster transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Warning</span>
              </button>
              {result.score >= 55 && (
                <button
                  onClick={() => handleSearchOfficial(result.category)}
                  className="text-xs font-bold uppercase tracking-wider border border-forest text-forest px-4 py-2 hover:bg-forest hover:text-alabaster transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Search Official Helpline</span>
                </button>
              )}
              <button
                onClick={handleReset}
                className="text-xs font-bold uppercase tracking-wider text-charcoal/50 border border-charcoal/10 px-4 py-2 hover:border-charcoal hover:text-charcoal transition-all hover:-translate-y-0.5"
              >
                Scan Another Item
              </button>
            </div>

          </div>
        )}

        {/* VIEW: THREAT LOG */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-2">[ SCAM SHIELD HISTORICAL LEDGER ]</span>
            
            {historyLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="border border-charcoal/10 bg-alabaster/40 p-4 space-y-2 animate-pulse">
                    <div className="h-4 w-24 bg-charcoal/10 rounded" />
                    <div className="h-5 w-2/3 bg-charcoal/15 rounded" />
                    <div className="h-3 w-1/3 bg-charcoal/5 rounded" />
                  </div>
                ))}
              </div>
            )}
            
            {!historyLoading && history.length === 0 && (
              <div className="border border-dashed border-charcoal/20 p-12 text-center">
                <p className="font-serif italic text-charcoal/40">Security log ledger is empty.</p>
              </div>
            )}

            {!historyLoading && history.length > 0 && (
              <div className="space-y-2">
                {history.map(s => {
                  const badge = RISK_BADGES[s.risk_level] || RISK_BADGES['LOW RISK'];
                  return (
                    <div key={s.id} className="border border-charcoal/15 bg-alabaster p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-charcoal transition-colors hover:bg-charcoal/[0.01]">
                      <div className="space-y-1 max-w-lg min-w-0">
                        <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 border flex items-center gap-1 w-fit ${badge.color}`}>
                          {React.createElement(badge.icon, { className: "w-3 h-3 stroke-[2.5px]" })}
                          <span>{s.risk_level} — {s.risk_score}%</span>
                        </span>
                        <div className="text-sm font-serif font-bold text-charcoal truncate mt-1">{s.question}</div>
                        <div className="text-[10px] text-charcoal/40 font-sans">{s.analysis?.summary}</div>
                      </div>
                      <span className="text-[10px] text-charcoal/40 font-sans shrink-0">
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
