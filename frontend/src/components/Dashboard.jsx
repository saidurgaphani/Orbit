import React, { useState } from 'react';
import MockFeatureView from './MockFeatureView';

const ALL_FEATURES = [
  // --- REAL FEATURES (5) ---
  {
    id: 'home',
    name: 'Home',
    category: 'CORE',
    description: 'Meteorological and chronological snapshot with budget context.',
    isReal: true,
  },
  {
    id: 'scam',
    name: 'Scam Detector',
    category: 'SECURITY',
    description: 'Threat analysis for suspicious communications.',
    isReal: true,
  },
  {
    id: 'docs',
    name: 'Document Brain',
    category: 'COGNITION',
    description: 'Multimodal OCR and document intelligence.',
    isReal: true,
  },
  {
    id: 'decision',
    name: 'Decision Engine',
    category: 'LOGIC',
    description: 'Objective framework for dilemma resolution.',
    isReal: true,
  },
  {
    id: 'finance',
    name: 'Finance Brain',
    category: 'ECONOMIC',
    description: 'Ledger analysis and spending optimization.',
    isReal: true,
  },
  
  // --- EXTENDED VISION MOCKED FEATURES (14) ---
  {
    id: 'timeline',
    name: 'Life Timeline',
    category: 'CHRONOLOGICAL',
    description: 'A searchable, infinite-scroll history of your life events.',
    isReal: false,
    mockSummary: 'Timeline indexing complete. 12,405 significant events recorded since 2018. Memory retrieval optimization at 98%.',
    mockData: [
      { title: 'Last week', detail: 'You spent 14 hours in deep work, a 20% increase from the prior week.' },
      { title: '3 years ago today', detail: 'You adopted your dog, Buster. Consider scheduling an annual vet checkup.' }
    ]
  },
  {
    id: 'health',
    name: 'Health Intelligence',
    category: 'PHYSIOLOGICAL',
    description: 'Centralized health dashboard combining biometrics, manual logs, OCR medical reports, and AI coaching.',
    isReal: true,
  },
  {
    id: 'goals',
    name: 'Goal Engine',
    category: 'STRATEGIC',
    description: 'Algorithmic breakdown of macro ambitions into micro tasks, milestones, and habit loops.',
    isReal: true,
  },
  {
    id: 'twin',
    name: 'Digital Twin',
    category: 'SIMULATION',
    description: 'A persona clone that takes meetings and drafts replies in your voice.',
    isReal: false,
    mockSummary: 'Digital Twin is currently handling 3 email threads and is scheduled to attend 1 low-priority sync.',
    mockData: [
      { title: 'Email Handled', detail: 'Drafted 4 responses to vendor inquiries matching your standard tone.' },
      { title: 'Meeting Scheduled', detail: 'Attending "Weekly Status Sync" at 2 PM as a listener.' }
    ]
  },
  {
    id: 'auto',
    name: 'Automation Core',
    category: 'INFRASTRUCTURE',
    description: 'Zapier-style cross-app workflow builder, entirely prompt-driven.',
    isReal: false,
    mockSummary: '6 active workflows running. 24 tasks automated in the last 24 hours. Saved approx 1.2 hours of manual labor.',
    mockData: [
      { title: 'Invoice Processing', detail: 'Extracted 3 PDF invoices from Gmail and logged them to Airtable.' },
      { title: 'Lead Routing', detail: 'Sent 12 new Typeform entries to the designated Slack channel.' }
    ]
  },
  {
    id: 'persona',
    name: 'Personality Modes',
    category: 'INTERFACE',
    description: 'Switch EVA between professional, casual, mentor, or drill-sergeant.',
    isReal: false,
    mockSummary: 'Current mode: Professional & Concise. Tone drift is zero. Empathy parameter set to low.',
    mockData: [
      { title: 'Active Mode', detail: 'Professional. Output is structured, direct, and avoids colloquialisms.' },
      { title: 'Switch Option', detail: 'Recommend "Mentor" mode for your upcoming brainstorming session.' }
    ]
  },
  {
    id: 'voice',
    name: 'Voice Mode',
    category: 'INTERFACE',
    description: 'Always-on, low-latency conversational audio interface.',
    isReal: false,
    mockSummary: 'Microphone hardware linked. Wake word "Hey EVA" is active with 99.8% precision.',
    mockData: [
      { title: 'Last Session', detail: '14-minute conversation during morning commute. Action items extracted.' },
      { title: 'Latency', detail: 'Average end-to-end voice response time: 240ms.' }
    ]
  },
  {
    id: 'emergency',
    name: 'Emergency Mode',
    category: 'SECURITY',
    description: 'Lockdown protocols, legal rights retrieval, and emergency SOS.',
    isReal: false,
    mockSummary: 'Emergency protocols primed. Trusted contacts verified. Local offline redundancy is active.',
    mockData: [
      { title: 'Offline Cache', detail: 'Critical medical and identification data is cached locally for zero-connectivity access.' },
      { title: 'Trusted Contacts', detail: '3 contacts verified via SMS ping 12 hours ago.' }
    ]
  },
  {
    id: 'relationship',
    name: 'Relationship Manager',
    category: 'SOCIAL',
    description: 'CRM for personal life. Gift ideas, check-in reminders, context logging.',
    isReal: false,
    mockSummary: 'Network health is stable. 2 upcoming birthdays detected. 1 relationship categorized as "drifting".',
    mockData: [
      { title: 'Upcoming: Mom', detail: 'Birthday in 14 days. Based on her recent Pinterest activity, she wants a ceramic vase.' },
      { title: 'Check-in: Alex', detail: 'You haven\'t spoken in 4 weeks. Suggestion: Send a text about the new sci-fi movie.' }
    ]
  },
  {
    id: 'gov',
    name: 'Gov Assistant',
    category: 'ADMINISTRATIVE',
    description: 'Navigates bureaucracy, auto-fills tax forms, handles DMV tasks.',
    isReal: false,
    mockSummary: 'Tax documents analyzed. Auto-fill confidence at 94%. Waiting for final W2 upload.',
    mockData: [
      { title: 'Vehicle Registration', detail: 'Due in 45 days. Auto-renewal paperwork has been drafted.' },
      { title: 'Tax Prep', detail: 'Identified 14 potential deductions from last year\'s ledger.' }
    ]
  },
  {
    id: 'learning',
    name: 'Learning Brain',
    category: 'COGNITION',
    description: 'Creates custom curricula and quizzes based on your exact knowledge gaps.',
    isReal: false,
    mockSummary: 'Current module: Advanced React Patterns. Retention score at 82%. Ready for next assessment.',
    mockData: [
      { title: 'Spaced Repetition', detail: '4 flashcards due for review today.' },
      { title: 'Curriculum Generation', detail: 'Drafting syllabus for "Introduction to Machine Learning" based on your current math proficiency.' }
    ]
  },
  {
    id: 'opportunity',
    name: 'Opportunity Finder',
    category: 'STRATEGIC',
    description: 'Scrapes the web for jobs, grants, or investments that match your profile.',
    isReal: false,
    mockSummary: 'Scanning 402 sources. Found 3 high-match job postings and 1 relevant startup grant.',
    mockData: [
      { title: 'Job Match (94%)', detail: 'Senior Frontend Engineer at Anthropic. Salary band matches your requirements.' },
      { title: 'Grant Match', detail: 'Open-source tooling grant deadline in 3 weeks. You meet 5/5 criteria.' }
    ]
  },
  {
    id: 'reflection',
    name: 'Daily Reflection',
    category: 'PSYCHOLOGICAL',
    description: 'Guided journaling and sentiment analysis of your daily entries.',
    isReal: false,
    mockSummary: 'Sentiment analysis shows a 12% increase in stress markers over the past week.',
    mockData: [
      { title: 'Theme Detected', detail: 'You frequently mention "lack of time" on Thursdays.' },
      { title: 'Journal Prompt', detail: '"What is one obligation you can drop this week without consequence?"' }
    ]
  },
  {
    id: 'asset',
    name: 'Asset Tracker',
    category: 'ECONOMIC',
    description: 'Real-time valuation of hardware, vehicles, and illiquid assets.',
    isReal: false,
    mockSummary: 'Total estimated physical asset value updated. Depreciation schedule on electronics adjusted.',
    mockData: [
      { title: 'MacBook Pro M3', detail: 'Current secondary market value: $1,850 (-$150 from last month).' },
      { title: 'Vehicle (Honda)', detail: 'Market value holding steady at $14,200 based on local sales data.' }
    ]
  }
];

export default function Dashboard({ onNavigateToTab }) {
  const [selectedMock, setSelectedMock] = useState(null);

  if (selectedMock) {
    return (
      <MockFeatureView 
        feature={selectedMock} 
        onBack={() => setSelectedMock(null)} 
      />
    );
  }

  return (
    <div className="border border-charcoal p-6 md:p-8 bg-alabaster">
      <div className="border-b border-charcoal pb-4 mb-8">
        <span className="text-xs uppercase font-semibold tracking-wider text-forest">[ SYSTEM OVERVIEW ]</span>
        <h2 className="text-3xl font-serif mt-1 font-semibold">Life Dashboard</h2>
        <p className="text-sm text-charcoal/70 mt-1 font-sans">
          Select a module to access specialized cognitive functions. Active modules are live; extended vision modules demonstrate planned capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ALL_FEATURES.map((feature) => (
          <button
            key={feature.id}
            onClick={() => {
              if (feature.isReal) {
                onNavigateToTab(feature.id);
              } else {
                setSelectedMock(feature);
              }
            }}
            className="group text-left border border-charcoal p-5 bg-alabaster hover:border-forest transition-colors flex flex-col h-full min-h-[160px]"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal/60 group-hover:text-forest transition-colors">
                [ {feature.category} ]
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 border uppercase font-bold tracking-wider ${
                feature.isReal 
                  ? 'border-forest text-forest bg-forest/5' 
                  : 'border-charcoal/30 text-charcoal/40 bg-charcoal/5'
              }`}>
                {feature.isReal ? 'ACTIVE' : 'MOCKED'}
              </span>
            </div>
            
            <h3 className="text-xl font-serif font-bold mb-2 text-charcoal">{feature.name}</h3>
            <p className="text-xs font-sans text-charcoal/70 leading-relaxed mt-auto">
              {feature.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
