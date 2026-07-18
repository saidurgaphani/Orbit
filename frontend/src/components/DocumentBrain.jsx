import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, 
  Coins, 
  Heart, 
  GraduationCap, 
  Scale, 
  Folder, 
  Plane, 
  Home as HomeIcon, 
  ShieldCheck, 
  Briefcase, 
  FolderOpen,
  Search,
  Clock,
  Link2,
  FileText,
  FileImage,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Eye,
  Download,
  AlertCircle
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Identity', 'Financial', 'Medical', 'Education', 'Legal', 'Personal', 'Travel', 'Home', 'Insurance', 'Employment'];

const CATEGORY_ICONS = {
  Identity: User, 
  Financial: Coins, 
  Medical: Heart, 
  Education: GraduationCap,
  Legal: Scale, 
  Personal: Folder, 
  Travel: Plane, 
  Home: HomeIcon,
  Insurance: ShieldCheck, 
  Employment: Briefcase, 
  All: FolderOpen,
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryClasses(days) {
  if (days === null) return '';
  if (days < 0) return 'text-terracotta border-terracotta bg-terracotta/5';
  if (days <= 30) return 'text-terracotta border-terracotta bg-terracotta/5 animate-pulse';
  if (days <= 90) return 'text-amber-600 border-amber-400 bg-amber-50';
  return 'text-forest border-forest bg-forest/5';
}

function expiryLabel(days) {
  if (days === null) return null;
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  return `${days}d left`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── PIPELINE STEPS ───────────────────────────────────────────────────────────
const PIPELINE = ['Reading file', 'Uploading', 'OCR & Text Extraction', 'AI Analysis', 'Categorizing', 'Saving to Vault'];

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyVault({ onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <FolderOpen className="w-16 h-16 text-charcoal/30 mb-6 select-none" />
      <h3 className="font-serif text-2xl font-bold mb-2">Your vault is empty</h3>
      <p className="text-sm font-sans text-charcoal/60 max-w-sm mb-8 leading-relaxed">
        Upload any document — passport, salary slip, medical report, rental agreement — and Orbit will read, understand, and organize it automatically.
      </p>
      <button
        onClick={onUpload}
        className="bg-charcoal text-alabaster font-sans px-6 py-2.5 uppercase text-xs font-bold tracking-wider hover:bg-forest transition-colors border border-charcoal hover:-translate-y-0.5 transition-transform"
      >
        Upload First Document
      </button>
      <div className="mt-10 grid grid-cols-3 gap-4 max-w-md text-left">
        {[
          { icon: Search, title: 'Smart Search', desc: 'Ask in plain English' },
          { icon: Clock, title: 'Expiry Alerts', desc: 'Never miss a renewal' },
          { icon: Link2, title: 'Doc Connections', desc: 'Sees relationships' },
        ].map(f => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="border border-charcoal/20 p-3 bg-alabaster flex flex-col items-start hover:-translate-y-0.5 transition-transform">
              <Icon className="w-5 h-5 text-charcoal/60 mb-1.5" />
              <div className="text-xs font-bold uppercase tracking-wider text-charcoal">{f.title}</div>
              <div className="text-[10px] text-charcoal/50 mt-0.5">{f.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DOCUMENT CARD ────────────────────────────────────────────────────────────
function DocCard({ doc, onClick, onDelete }) {
  const days = daysUntil(doc.expiryDate);
  const expClass = expiryClasses(days);
  const expLabel = expiryLabel(days);
  
  const DocIcon = CATEGORY_ICONS[doc.category] || FileText;

  return (
    <div
      className="border border-charcoal/30 bg-alabaster hover:border-charcoal hover:shadow-[3px_3px_0px_0px_rgba(30,32,30,0.15)] transition-all cursor-pointer group relative"
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <DocIcon className="w-5 h-5 text-forest shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-forest">{doc.category}</div>
              <div className="text-sm font-serif font-semibold truncate text-charcoal">{doc.fileName}</div>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] uppercase tracking-wider text-charcoal/40 hover:text-terracotta transition-all shrink-0 px-1"
            title="Remove from vault"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Summary snippet */}
        {doc.summary && (
          <p className="text-xs font-sans text-charcoal/60 line-clamp-2 mb-3 leading-relaxed">
            {doc.summary.replace(/^\[DEMO\]\s*/i, '')}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-charcoal/40 font-sans">{formatDate(doc.uploadedAt)}</span>
          {expLabel && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${expClass}`}>
              {expLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD PANEL ─────────────────────────────────────────────────────────────
function UploadPanel({ onSuccess, onCancel }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(-1); // -1 = idle, 0..5 = pipeline step, 6 = done, -2 = error
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (selected) => {
    if (!selected) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selected.type)) {
      setError('Unsupported format. Please upload JPG, PNG, WebP, or PDF.');
      return;
    }
    setError('');
    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setError('');

    // Step through pipeline visually
    const advance = (s) => new Promise(res => {
      setStep(s);
      setTimeout(res, s === 1 ? 600 : s === 2 ? 800 : s === 3 ? 1200 : 500);
    });

    await advance(0); // Reading file
    const reader = new FileReader();
    const base64 = await new Promise((res, rej) => {
      reader.onloadend = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    await advance(1); // Uploading
    await advance(2); // OCR

    try {
      await advance(3); // AI Analysis
      const response = await fetch(`${BACKEND}/documents/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64,
          fileSize: file.size,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${response.status})`);
      }

      await advance(4); // Categorizing
      await advance(5); // Saving
      setStep(6); // Done

      const doc = await response.json();
      setTimeout(() => onSuccess(doc), 800);
    } catch (err) {
      setStep(-2);
      setError(err.message || 'Upload failed. Please try again.');
    }
  };

  const isProcessing = step >= 0 && step < 6;
  const isDone = step === 6;

  return (
    <div className="border border-charcoal p-6 md:p-8 bg-alabaster">
      <div className="border-b border-charcoal pb-4 mb-6 flex justify-between items-start">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-1">[ VAULT INTAKE ]</span>
          <h3 className="text-2xl font-serif font-bold">Upload Document</h3>
          <p className="text-sm text-charcoal/60 mt-1">Orbit will read, understand, and categorize your document automatically.</p>
        </div>
        <button onClick={onCancel} className="text-xs uppercase tracking-wider font-bold text-charcoal/40 hover:text-charcoal transition-colors flex items-center gap-1.5 hover:-translate-y-0.5 transition-transform">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Drop Zone */}
      {!isProcessing && !isDone && (
        <div
          className={`border-2 border-dashed p-10 text-center transition-all mb-6 cursor-pointer flex flex-col items-center justify-center min-h-[200px] ${
            isDragging ? 'border-forest bg-forest/5' : 'border-charcoal/30 hover:border-charcoal'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              {file.type === 'application/pdf' ? (
                <FileText className="w-10 h-10 text-forest" />
              ) : (
                <FileImage className="w-10 h-10 text-forest" />
              )}
              <span className="font-serif text-lg font-semibold text-charcoal mt-2">{file.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-charcoal/50">
                {formatFileSize(file.size)} · {file.type.split('/')[1].toUpperCase()} · Ready for analysis
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-charcoal/50">
              <UploadCloud className="w-10 h-10 text-charcoal/40 mb-1" />
              <span className="font-sans text-sm font-bold uppercase tracking-wider text-charcoal">Drag & Drop or Click to Browse</span>
              <span className="text-[10px] uppercase tracking-wider">JPG · PNG · WebP · PDF · Max 10 MB</span>
            </div>
          )}
        </div>
      )}

      {/* Pipeline Progress */}
      {isProcessing && (
        <div className="mb-6 border border-charcoal p-6 bg-alabaster">
          <div className="text-xs uppercase font-bold tracking-wider text-forest mb-4">[ PROCESSING PIPELINE ]</div>
          <div className="space-y-3">
            {PIPELINE.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <span className={`w-5 h-5 flex items-center justify-center border text-[10px] font-bold shrink-0 transition-all ${
                  i < step ? 'bg-charcoal border-charcoal text-alabaster' :
                  i === step ? 'border-forest text-forest animate-pulse' :
                  'border-charcoal/20 text-charcoal/30'
                }`}>
                  {i < step ? <CheckCircle2 className="w-3 h-3 stroke-[3px]" /> : i + 1}
                </span>
                <span className={`text-sm font-sans transition-all ${
                  i < step ? 'text-charcoal/60 line-through' :
                  i === step ? 'text-charcoal font-semibold' :
                  'text-charcoal/30'
                }`}>
                  {label}
                </span>
                {i === step && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-forest animate-pulse font-bold">Running...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done state */}
      {isDone && (
        <div className="mb-6 border border-forest p-6 bg-forest/5 text-center">
          <CheckCircle2 className="w-10 h-10 text-forest mx-auto mb-2 stroke-[2px]" />
          <div className="font-serif text-lg font-bold text-forest">Document added to vault</div>
          <div className="text-xs text-charcoal/60 mt-1">Opening document intelligence view...</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 border border-terracotta p-4 bg-terracotta/5 text-terracotta">
          <div className="text-xs uppercase font-bold tracking-wider mb-1">[ UPLOAD FAILED ]</div>
          <p className="text-sm font-sans">{error}</p>
        </div>
      )}

      {/* Actions */}
      {!isProcessing && !isDone && (
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!file}
            className="bg-charcoal text-alabaster font-sans px-6 py-2.5 uppercase text-xs font-bold tracking-wider hover:bg-forest transition-colors border border-charcoal disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Analyze & Store
          </button>
          <button
            onClick={() => { setFile(null); setError(''); setStep(-1); }}
            className="text-xs uppercase font-bold tracking-wider text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENT DETAIL PANEL ───────────────────────────────────────────────────
function DocDetailPanel({ doc, onBack, onDelete }) {
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef(null);

  const days = daysUntil(doc.expiryDate);
  const expClass = expiryClasses(days);
  const expLabel = expiryLabel(days);

  const askQuestion = async () => {
    if (!question.trim() || chatLoading) return;
    const q = question.trim();
    setQuestion('');
    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${BACKEND}/documents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, question: q }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.answer || 'No response.' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Error communicating with AI. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  return (
    <div className="border border-charcoal bg-alabaster">
      {/* Header */}
      <div className="border-b border-charcoal p-6 flex justify-between items-start">
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = CATEGORY_ICONS[doc.category] || FileText;
            return <Icon className="w-8 h-8 text-forest" />;
          })()}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-forest">{doc.category}</div>
            <h3 className="font-serif text-xl font-bold text-charcoal">{doc.fileName}</h3>
            <div className="text-[10px] text-charcoal/50 mt-0.5">
              Uploaded {formatDate(doc.uploadedAt)}
              {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onDelete(doc.id)}
            className="text-[10px] uppercase tracking-wider font-bold text-terracotta border border-terracotta px-2 py-1 hover:bg-terracotta hover:text-alabaster transition-colors hover:-translate-y-0.5 transition-transform"
          >
            Delete
          </button>
          <button
            onClick={onBack}
            className="text-xs uppercase font-bold tracking-wider text-charcoal/50 hover:text-charcoal transition-colors flex items-center gap-1.5 hover:-translate-y-0.5 transition-transform"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Vault</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
        {/* Left: AI Summary + Metadata + Chat */}
        <div className="md:col-span-3 border-r border-charcoal/20 divide-y divide-charcoal/10">
          {/* AI Summary */}
          <div className="p-5">
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ AI SUMMARY ]</span>
            <p className="font-serif italic text-base leading-relaxed text-charcoal">
              "{doc.summary?.replace(/^\[DEMO\]\s*/i, '') || 'No summary available.'}"
            </p>
            {doc.aiInsight && (
              <div className="mt-3 border-l-2 border-forest pl-3">
                <p className="text-xs font-sans text-charcoal/70">{doc.aiInsight}</p>
              </div>
            )}
          </div>

          {/* Expiry Alert */}
          {expLabel && (
            <div className={`p-5 border-l-4 ${days !== null && days <= 30 ? 'border-terracotta bg-terracotta/5' : days !== null && days <= 90 ? 'border-amber-500 bg-amber-50' : 'border-forest bg-forest/5'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-charcoal/60 block mb-1">Expiry Date</span>
                  <span className="font-serif text-base font-semibold">{formatDate(doc.expiryDate)}</span>
                </div>
                <span className={`text-sm font-bold uppercase tracking-wider px-3 py-1 border ${expClass}`}>
                  {expLabel}
                </span>
              </div>
            </div>
          )}

          {/* Smart Metadata */}
          {doc.metadata && Object.keys(doc.metadata).length > 0 && (
            <div className="p-5">
              <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ EXTRACTED FIELDS ]</span>
              <div className="space-y-2">
                {Object.entries(doc.metadata).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-baseline gap-4 py-1.5 border-b border-charcoal/10">
                    <span className="text-xs font-sans text-charcoal/60 shrink-0">{key}</span>
                    <span className="text-sm font-sans font-semibold text-charcoal text-right">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Chat */}
          <div className="p-5">
            <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ ASK ABOUT THIS DOCUMENT ]</span>
            {chatMessages.length > 0 && (
              <div ref={chatRef} className="mb-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`text-sm font-sans px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-charcoal text-alabaster ml-8'
                      : 'bg-sage/20 border border-charcoal/20 text-charcoal'
                  }`}>
                    {msg.role === 'ai' && <span className="text-[10px] font-bold uppercase tracking-wider text-forest block mb-1">Orbit</span>}
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-sage/20 border border-charcoal/20 text-charcoal text-sm font-sans px-3 py-2 animate-pulse">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-forest block mb-1">Orbit</span>
                    Thinking...
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') askQuestion(); }}
                placeholder={`e.g. "When does this expire?" or "What is the rent amount?"`}
                className="flex-1 bg-alabaster border border-charcoal/40 px-3 py-2 text-sm font-sans text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-charcoal"
                disabled={chatLoading}
              />
              <button
                onClick={askQuestion}
                disabled={!question.trim() || chatLoading}
                className="bg-charcoal text-alabaster px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-forest transition-colors disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* Right: Intelligence Graph / Related */}
        <div className="md:col-span-2 p-5">
          <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ INTELLIGENCE GRAPH ]</span>
          <p className="text-[10px] text-charcoal/40 font-sans mb-4 leading-relaxed">
            Orbit has detected these document types related to <span className="font-bold text-charcoal">{doc.fileName}</span>. Upload them to create live connections.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 border border-charcoal/20 p-2 bg-alabaster">
              {React.createElement(CATEGORY_ICONS[doc.category] || FileText, { className: "w-5 h-5 text-forest" })}
              <div>
                <div className="text-xs font-bold text-charcoal">{doc.fileName}</div>
                <div className="text-[10px] text-forest uppercase tracking-wider">This Document</div>
              </div>
            </div>
            {(doc.relatedTypes || []).map((type, i) => (
              <div key={i} className="flex items-center gap-2 border border-dashed border-charcoal/20 p-2 bg-alabaster/60 opacity-70 hover:opacity-100 transition-opacity cursor-default">
                {(() => {
                  const RelatedIcon = CATEGORY_ICONS[type] || FileText;
                  return <RelatedIcon className="w-5 h-5 text-charcoal/40" />;
                })()}
                <div>
                  <div className="text-xs font-sans text-charcoal/70">{type}</div>
                  <div className="text-[10px] text-charcoal/40 uppercase tracking-wider">Upload to link</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick suggested questions */}
          {chatMessages.length === 0 && (
            <div className="mt-6">
              <span className="text-xs uppercase font-bold tracking-wider text-charcoal/40 block mb-2">Suggested Questions</span>
              <div className="space-y-1.5">
                {[
                  'When does this expire?',
                  'Summarize this document.',
                  'What are the key details?',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => setQuestion(q)}
                    className="w-full text-left text-[11px] font-sans text-charcoal/60 hover:text-charcoal border border-charcoal/15 hover:border-charcoal/40 px-2.5 py-1.5 transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
                  >
                    <ArrowRight className="w-3 h-3 text-charcoal/40" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VAULT DASHBOARD ─────────────────────────────────────────────────────────
function VaultDashboard({ docs, loading, onSelectDoc, onUpload, onDelete, onSearch }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const expiringCount = docs.filter(d => {
    const days = daysUntil(d.expiryDate);
    return days !== null && days >= 0 && days <= 180;
  }).length;

  const categories = [...new Set(docs.map(d => d.category))];

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`${BACKEND}/documents/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => { setSearchQuery(''); setSearchResults(null); };

  const displayDocs = searchResults !== null
    ? searchResults
    : activeCategory === 'All'
      ? docs
      : docs.filter(d => d.category === activeCategory);

  const expiringDocs = docs.filter(d => {
    const days = daysUntil(d.expiryDate);
    return days !== null && days >= 0 && days <= 180;
  }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-charcoal p-6 bg-alabaster">
        <div className="flex justify-between items-start mb-5">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-forest block mb-1">[ DIGITAL LIFE VAULT ]</span>
            <h2 className="text-3xl font-serif font-bold">Document Brain</h2>
            <p className="text-sm text-charcoal/60 mt-1">Every document. Instantly understood. Always available.</p>
          </div>
          <button
            onClick={onUpload}
            className="bg-charcoal text-alabaster font-sans px-5 py-2 uppercase text-xs font-bold tracking-wider hover:bg-forest transition-colors border border-charcoal shadow-[2px_2px_0px_0px_rgba(30,32,30,1)] flex items-center gap-1.5 hover:-translate-y-0.5 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Documents', value: docs.length, color: 'charcoal' },
            { label: 'Categories', value: categories.length || 0, color: 'forest' },
            { label: 'Expiring Soon', value: expiringCount, color: expiringCount > 0 ? 'terracotta' : 'charcoal' },
            { label: '% Organized', value: docs.length > 0 ? '100%' : '—', color: 'forest' },
          ].map(stat => (
            <div key={stat.label} className="border border-charcoal/20 p-3 text-center">
              <div className={`text-2xl font-serif font-black ${stat.color === 'terracotta' ? 'text-terracotta' : stat.color === 'forest' ? 'text-forest' : 'text-charcoal'}`}>
                {stat.value}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-charcoal/50 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Global AI Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder='Ask about your documents... "Find my passport" · "Show documents expiring soon" · "All medical records"'
          className="flex-1 bg-alabaster border border-charcoal/40 px-4 py-3 font-sans text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-charcoal"
        />
        <button
          type="submit"
          disabled={searching || !searchQuery.trim()}
          className="bg-charcoal text-alabaster px-5 py-3 text-xs font-bold uppercase tracking-wider hover:bg-forest transition-colors disabled:opacity-40"
        >
          {searching ? '...' : 'Search'}
        </button>
        {searchResults !== null && (
          <button
            type="button"
            onClick={clearSearch}
            className="text-xs font-bold uppercase tracking-wider text-charcoal/50 hover:text-charcoal px-2 flex items-center gap-1 hover:-translate-y-0.5 transition-transform"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </form>

      {/* Search results header */}
      {searchResults !== null && (
        <div className="border border-charcoal/20 px-4 py-2 bg-alabaster flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-forest">
            Search results for "{searchQuery}" — {searchResults.length} found
          </span>
        </div>
      )}

      {/* Category Filters (only when not searching) */}
      {searchResults === null && docs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {['All', ...categories].map(cat => {
            const TabIcon = CATEGORY_ICONS[cat] || FileText;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 border transition-all flex items-center gap-1.5 hover:-translate-y-0.5 ${
                  activeCategory === cat
                    ? 'bg-charcoal text-alabaster border-charcoal'
                    : 'border-charcoal/30 text-charcoal/60 hover:border-charcoal hover:text-charcoal'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expiring Soon Section */}
      {searchResults === null && expiringDocs.length > 0 && activeCategory === 'All' && (
        <div className="border border-amber-400 bg-amber-50">
          <div className="border-b border-amber-200 px-5 py-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Expiring Soon</span>
            <span className="text-[10px] border border-amber-400 text-amber-600 px-1.5 py-0.5 font-bold">{expiringDocs.length} documents</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
            {expiringDocs.map(doc => (
              <DocCard key={doc.id} doc={doc} onClick={() => onSelectDoc(doc)} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="border border-charcoal/20 p-4 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-8 h-8 bg-charcoal/10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-2 bg-charcoal/10 w-1/3" />
                  <div className="h-3 bg-charcoal/10 w-2/3" />
                </div>
              </div>
              <div className="h-2 bg-charcoal/10 w-full mb-1" />
              <div className="h-2 bg-charcoal/10 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && docs.length === 0 && <EmptyVault onUpload={onUpload} />}

      {/* Main Documents Grid */}
      {!loading && displayDocs.length > 0 && (
        <div>
          {searchResults === null && (
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50">
                {activeCategory === 'All' ? 'All Documents' : activeCategory} — {displayDocs.length} file{displayDocs.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayDocs.map(doc => (
              <DocCard key={doc.id} doc={doc} onClick={() => onSelectDoc(doc)} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}

      {/* No search results */}
      {searchResults !== null && searchResults.length === 0 && !searching && (
        <div className="border border-dashed border-charcoal/30 p-12 text-center flex flex-col items-center justify-center">
          <Search className="w-8 h-8 text-charcoal/30 mb-3" />
          <p className="font-serif italic text-charcoal/60">No documents found for "{searchQuery}"</p>
          <p className="text-xs text-charcoal/40 mt-2">Try different keywords or upload the document you're looking for.</p>
        </div>
      )}

      {/* AI Insights (shown when vault has docs) */}
      {!loading && docs.length > 0 && searchResults === null && activeCategory === 'All' && (
        <div className="border border-charcoal/20 p-5 bg-alabaster">
          <span className="text-xs uppercase font-bold tracking-wider text-charcoal/50 block mb-3">[ AI INSIGHTS ]</span>
          <div className="space-y-3">
            {expiringDocs.length > 0 && (
              <div className="flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-terracotta shrink-0 mt-0.5" />
                <p className="text-sm font-sans text-charcoal/70">
                  <span className="font-bold">{expiringDocs.length} document{expiringDocs.length !== 1 ? 's' : ''}</span> expire within the next 6 months. Check the Expiring Soon section above.
                </p>
              </div>
            )}
            {docs.filter(d => d.category === 'Medical').length >= 2 && (
              <div className="flex gap-2 items-start">
                <Heart className="w-4 h-4 text-forest shrink-0 mt-0.5" />
                <p className="text-sm font-sans text-charcoal/70">
                  You have <span className="font-bold">{docs.filter(d => d.category === 'Medical').length} medical documents</span> this year. Would you like a health summary?
                </p>
              </div>
            )}
            <div className="flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-forest shrink-0 mt-0.5" />
              <p className="text-sm font-sans text-charcoal/70">
                <span className="font-bold">{docs.length} document{docs.length !== 1 ? 's' : ''}</span> stored across {categories.length} {categories.length !== 1 ? 'categories' : 'category'}. Vault is 100% organized.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DocumentBrain() {
  const [view, setView] = useState('vault'); // 'vault' | 'upload' | 'detail'
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/documents`);
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUploadSuccess = (doc) => {
    setDocs(prev => [doc, ...prev]);
    setSelectedDoc(doc);
    setView('detail');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this document from your vault?')) return;
    try {
      await fetch(`${BACKEND}/documents/${id}`, { method: 'DELETE' });
      setDocs(prev => prev.filter(d => d.id !== id));
      if (selectedDoc?.id === id) { setSelectedDoc(null); setView('vault'); }
    } catch {
      alert('Failed to delete document. Please try again.');
    }
  };

  return (
    <div>
      {view === 'vault' && (
        <VaultDashboard
          docs={docs}
          loading={loading}
          onSelectDoc={(doc) => { setSelectedDoc(doc); setView('detail'); }}
          onUpload={() => setView('upload')}
          onDelete={handleDelete}
        />
      )}
      {view === 'upload' && (
        <UploadPanel
          onSuccess={handleUploadSuccess}
          onCancel={() => setView('vault')}
        />
      )}
      {view === 'detail' && selectedDoc && (
        <DocDetailPanel
          doc={selectedDoc}
          onBack={() => { setSelectedDoc(null); setView('vault'); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
