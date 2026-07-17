import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Home as HomeIcon, 
  Compass, 
  Heart, 
  FileText, 
  Scale, 
  Coins, 
  ShieldAlert, 
  Cog, 
  Target, 
  Sun, 
  CloudSun, 
  Sunset, 
  CloudRain, 
  CloudLightning, 
  X,
  Menu
} from 'lucide-react';
import ScamDetector from './components/ScamDetector';
import Home from './components/Home';
import HeroDock from './components/ui/dock';
import Dashboard from './components/Dashboard';
import DocumentBrain from './components/DocumentBrain';
import DecisionEngine from './components/DecisionEngine';
import FinanceBrain from './components/FinanceBrain';
import HealthIntelligence from './components/HealthIntelligence';
import GoalEngine from './components/GoalEngine';


const BACKEND = 'http://localhost:5001';
const FALLBACK_LOCATION = { lat: 19.0760, lon: 72.8777, name: 'Mumbai' };

// Helper for weather icons
function getWeatherIcon(condition) {
  if (!condition) return Sun;
  const cond = condition.toLowerCase();
  if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower') || cond.includes('showers')) return CloudRain;
  if (cond.includes('thunder')) return CloudLightning;
  if (cond.includes('cloud') || cond.includes('overcast')) return CloudSun;
  return Sun;
}

function LiveSidebar({ activeTab, onNavigateToTab, userLocation, isOpen, onToggleManual, user, onLogout }) {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [events, setEvents] = useState([]);

  const fetchWeather = useCallback(async () => {
    if (!userLocation) return;
    setWeatherLoading(true);
    try {
      const res = await fetch(`${BACKEND}/weather?lat=${userLocation.lat}&lon=${userLocation.lon}&city=${encodeURIComponent(userLocation.name)}`);
      const data = await res.json();
      setWeather(data);
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  }, [userLocation]);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/calendar/events`);
      const data = await res.json();
      setCalendarLinked(data.linked);
      setEvents(data.events || []);
    } catch {
      setCalendarLinked(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    fetchCalendar();
  }, [fetchWeather, fetchCalendar]);

  function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  const sidebarTabs = [
    { icon: HomeIcon, tab: 'home', label: 'Home' },
    { icon: Compass, tab: 'dashboard', label: 'Dashboard' },
    { icon: Heart, tab: 'health', label: 'Health Intel' },
    { icon: FileText, tab: 'docs', label: 'Doc Brain' },
    { icon: Scale, tab: 'decision', label: 'Decision' },
    { icon: Coins, tab: 'finance', label: 'Finance' },
    { icon: Target, tab: 'goals', label: 'Goals' },
    { icon: ShieldAlert, tab: 'scam', label: 'Scam Shield' },
  ];

  const isHome = activeTab === 'home';

  return (
    <section className={`relative bg-alabaster shrink-0 transition-all duration-300 ease-in-out z-30 overflow-visible order-last lg:order-first
      ${isHome 
        ? `w-full border-t border-charcoal p-5 sm:p-6 space-y-6 flex flex-col lg:border-t-0 
           ${isOpen 
             ? "lg:w-[350px] lg:border-r lg:p-6 lg:md:p-8" 
             : "lg:w-0 lg:p-0 lg:border-r-0"
           }`
        : "hidden"
      }
    `}>
      
      {/* Toggle Button placed exactly on the dividing line/border: Only visible on Home tab on Desktop */}
      {isHome && (
        <button
          onClick={() => onToggleManual(!isOpen)}
          className={`absolute top-[150px] z-40 bg-alabaster border border-charcoal text-charcoal w-8 h-8 rounded-full hover:bg-charcoal hover:text-alabaster transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer max-lg:hidden ${
            isOpen ? "right-0 translate-x-1/2" : "left-4"
          }`}
          title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      )}

      {/* Inner Contents: Hidden on desktop when closed, but always visible on mobile */}
      <div className={`flex flex-col h-full space-y-5 transition-opacity duration-200 lg:overflow-y-auto no-scrollbar ${
        isOpen ? "opacity-100 lg:flex" : "lg:opacity-0 lg:pointer-events-none lg:hidden"
      }`}>
        {/* System Status */}
        <div className="border border-charcoal p-5 bg-alabaster">
          <span className="text-xs uppercase font-bold tracking-wider text-charcoal/60 block mb-3">
            [ SYSTEM STATUS ]
          </span>
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-sans text-charcoal/70 whitespace-nowrap">Active Module</span>
              <span className="text-[10px] font-bold uppercase tracking-wider border border-forest text-forest px-2 py-0.5 bg-forest/5 whitespace-nowrap truncate max-w-[120px] sm:max-w-[150px]">
                {activeTab.replace(/-/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-sans text-charcoal/70 whitespace-nowrap">AI Core</span>
              <span className="text-[10px] font-bold text-forest uppercase tracking-wider whitespace-nowrap">ONLINE</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-sans text-charcoal/70 whitespace-nowrap">Calendar</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${calendarLinked ? 'text-forest' : 'text-terracotta'}`}>
                {calendarLinked ? 'LINKED' : 'UNLINKED'}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-sans text-charcoal/70 whitespace-nowrap">Today</span>
              <span className="text-[10px] font-bold text-charcoal uppercase tracking-wider whitespace-nowrap">{todayStr}</span>
            </div>
          </div>
        </div>

        {/* Live Weather */}
        <div className="border border-charcoal p-5 bg-alabaster">
          <span className="text-xs uppercase font-bold tracking-wider text-charcoal/60 block mb-3">
            [ METEOROLOGICAL MATRIX ]
          </span>
          {weatherLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-charcoal/10 w-2/3"></div>
              <div className="h-6 bg-charcoal/10 w-1/3"></div>
            </div>
          ) : weather ? (
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <h3 className="font-serif text-lg font-bold truncate">{weather.city}</h3>
                <p className="text-xs uppercase tracking-wider text-charcoal/70 mt-0.5 whitespace-nowrap truncate">
                  {weather.condition} &bull; Hum {weather.humidity}%
                </p>
                <p className="text-xs text-charcoal/50 mt-1 whitespace-nowrap">Wind {weather.windSpeed} km/h</p>
              </div>
              <div className="text-right flex flex-col items-end shrink-0">
                {React.createElement(getWeatherIcon(weather.condition), { className: "w-6 h-6 text-charcoal/60 mb-1" })}
                <span className="text-3xl font-serif font-bold leading-none">{weather.temperature}{weather.unit}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs font-serif italic text-charcoal/40">Weather data unavailable.</p>
          )}
        </div>

        {/* Live Calendar */}
        <div className="border border-charcoal p-5 bg-alabaster">
          <div className="flex justify-between items-center gap-2 mb-4">
            <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-charcoal/60 whitespace-nowrap">
              [ CHRONOLOGICAL MATRIX ]
            </span>
            <span className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 border whitespace-nowrap shrink-0 ${
              calendarLinked
                ? 'border-forest text-forest bg-forest/5'
                : 'border-terracotta text-terracotta bg-terracotta/5'
            }`}>
              {calendarLinked ? `${events.length} EVENT${events.length !== 1 ? 'S' : ''}` : 'UNLINKED'}
            </span>
          </div>

          {!calendarLinked ? (
            <div className="border border-dashed border-charcoal/40 p-4 text-center">
              <p className="text-xs font-serif italic text-charcoal/60 mb-3">
                Link Google Calendar to see today's schedule.
              </p>
              <a
                href="http://localhost:5001/auth/google"
                className="bg-charcoal text-alabaster px-4 py-1.5 uppercase text-[10px] font-bold tracking-wider hover:bg-forest transition-colors border border-charcoal inline-block hover:-translate-y-0.5 transition-transform"
              >
                LINK GOOGLE CALENDAR
              </a>
            </div>
          ) : events.length === 0 ? (
            <p className="text-xs font-serif italic text-charcoal/50">No events scheduled for today.</p>
          ) : (
            <div className="space-y-2.5">
              {events.slice(0, 4).map((event) => (
                <div key={event.id} className="border-b border-charcoal/15 pb-2 flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold truncate">{event.title}</h4>
                    {event.location && (
                      <p className="text-[10px] text-charcoal/50 truncate mt-0.5">{event.location}</p>
                    )}
                  </div>
                  <span className="text-[10px] border border-charcoal/40 px-1.5 py-0.5 whitespace-nowrap shrink-0">
                    {event.isAllDay ? 'ALL DAY' : formatTime(event.start)}
                  </span>
                </div>
              ))}
              {events.length > 4 && (
                <p className="text-[10px] text-charcoal/40 uppercase tracking-wider">
                  + {events.length - 4} more event{events.length - 4 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Nav */}
        <div className="border border-charcoal p-5 bg-alabaster">
          <span className="text-xs uppercase font-bold tracking-wider text-charcoal/60 block mb-3">
            [ QUICK ACCESS ]
          </span>
          <div className="grid grid-cols-2 gap-2">
            {sidebarTabs.map(({ label, tab }) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  onNavigateToTab(tab);
                  onToggleManual(false);
                }}
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 border text-center transition-all hover:-translate-y-0.5 ${
                  activeTab === tab
                    ? 'bg-charcoal text-alabaster border-charcoal'
                    : 'border-charcoal/30 text-charcoal/60 hover:border-charcoal hover:text-charcoal'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* User Profile & Log Out */}
        <div className="border border-charcoal p-4 bg-alabaster flex flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full border border-charcoal object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full border border-charcoal bg-forest text-alabaster flex items-center justify-center font-mono font-bold text-xs uppercase shrink-0">
                {user?.name?.slice(0, 2) || 'US'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-serif font-bold text-charcoal truncate">{user?.name || 'User'}</p>
              <p className="text-[9px] font-mono text-charcoal/40 truncate uppercase">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="border border-charcoal hover:bg-terracotta hover:text-alabaster hover:border-terracotta px-2.5 py-1.5 font-mono font-bold text-[9px] uppercase tracking-wider transition-colors shrink-0"
          >
            Log Out
          </button>
        </div>

        {/* Footer */}
        <div className="pt-3 text-center lg:text-left shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-charcoal/40">
            EVA &copy; 2026 — COGNITIVE SYSTEMS CO.
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

// Resolve city name from coordinates using Nominatim (OpenStreetMap, free, no key)
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    // Try city > town > county > state in that order
    const name = addr.city || addr.town || addr.village || addr.county || addr.state || 'Your Location';
    return { lat, lon, name };
  } catch {
    return null;
  }
}

export default function App() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const [activeTab, setActiveTab] = useState('home');
  const [userLocation, setUserLocation] = useState(null); // null = detecting
  const [sidebarUserOverride, setSidebarUserOverride] = useState(null);

  // Global Date Context State
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    if (selectedDate === todayStr) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const nextDateStr = d.toISOString().split('T')[0];
    if (nextDateStr <= todayStr) {
      setSelectedDate(nextDateStr);
    }
  };

  const handleDateChange = (dateVal) => {
    if (dateVal <= todayStr) {
      setSelectedDate(dateVal);
    }
  };

  const handleBackToToday = () => {
    setSelectedDate(todayStr);
  };

  const formatFriendlyDate = (dateString) => {
    if (dateString === todayStr) return 'TODAY';
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (dateString === yesterdayStr) return 'YESTERDAY';
    
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  };

  // Derived sidebarOpen state: respect override if set, else route default
  const sidebarOpen = sidebarUserOverride !== null ? sidebarUserOverride : (activeTab === 'home');

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSidebarUserOverride(null); // Reset manual override on navigation
  };

  // Detect user's real location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(FALLBACK_LOCATION);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const resolved = await reverseGeocode(lat, lon);
        setUserLocation(resolved || { lat, lon, name: 'Your Location' });
      },
      () => {
        // Permission denied or unavailable — fall back to Mumbai
        setUserLocation(FALLBACK_LOCATION);
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 } // cache for 5 minutes
    );
  }, []);

  // Handle hash-based navigation from quick access sidebar links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveTab(hash);
        setSidebarUserOverride(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const tabs = [
    { id: 'dashboard', name: 'Life Dashboard', status: 'ACTIVE' },
    { id: 'home', name: 'Home', status: 'ACTIVE' },
    { id: 'scam', name: 'Scam Detector', status: 'ACTIVE' },
    { id: 'docs', name: 'Document Brain', status: 'ACTIVE' },
    { id: 'decision', name: 'Decision Engine', status: 'ACTIVE' },
    { id: 'finance', name: 'Finance Brain', status: 'ACTIVE' },
    { id: 'health', name: 'Health Intelligence', status: 'ACTIVE' },
    { id: 'goals', name: 'Goal Engine', status: 'ACTIVE' },
  ];

  const showDateController = ['dashboard', 'home', 'finance', 'health', 'goals'].includes(activeTab);

  return (
    <div className="min-h-screen lg:h-screen bg-alabaster text-charcoal font-sans flex flex-col relative lg:overflow-hidden">

      {/* Editorial Header */}
      <header className="border-b border-charcoal py-4 px-6 md:px-12 flex flex-row justify-between items-center gap-4 bg-alabaster shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-4xl font-serif font-black tracking-tight leading-none">EVA</h1>
            <span className="text-xs uppercase tracking-widest font-semibold text-forest mt-1 block">
              EVERYDAY VIRTUAL ASSISTANT &bull; PLATFORM LAYER
            </span>
          </div>
        </div>
        <HeroDock activeTab={activeTab} onNavigateToTab={handleTabChange} />
      </header>

      {/* Main Flex-Row Responsive Layout */}
      <main className="flex-1 flex flex-col lg:flex-row gap-0 border-b border-charcoal relative lg:overflow-hidden lg:min-h-0">

        {/* Left Column: Live Status Sidebar */}
        <LiveSidebar 
          activeTab={activeTab} 
          onNavigateToTab={handleTabChange} 
          userLocation={userLocation} 
          isOpen={sidebarOpen}
          onToggleManual={setSidebarUserOverride}
          user={user}
          onLogout={logout}
        />

        {/* Right Column: Active Workspace Panel (Auto-expanding, Scrollable) */}
        <section className="flex-1 p-6 md:p-8 space-y-6 bg-alabaster min-w-0 transition-all duration-300 lg:h-full lg:overflow-y-auto lg:scroll-smooth">

          {/* Global Date controller widget */}
          {showDateController && (
            <div className="border border-charcoal bg-alabaster p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans shrink-0 transition-all duration-300">
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrevDay} 
                  className="border border-charcoal px-3 py-1.5 hover:bg-charcoal hover:text-alabaster font-mono font-bold transition-all text-sm flex items-center justify-center"
                  title="Previous Day"
                >
                  &larr;
                </button>
                <span className="font-serif font-black text-lg tracking-wide uppercase px-2 min-w-[140px] text-center select-none">
                  {formatFriendlyDate(selectedDate)}
                </span>
                <button 
                  onClick={handleNextDay} 
                  disabled={selectedDate === todayStr}
                  className={`border border-charcoal px-3 py-1.5 font-mono font-bold transition-all text-sm flex items-center justify-center ${selectedDate === todayStr ? 'opacity-40 cursor-not-allowed' : 'hover:bg-charcoal hover:text-alabaster'}`}
                  title="Next Day"
                >
                  &rarr;
                </button>
              </div>
              <div className="flex flex-row items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
                <input 
                  type="date" 
                  value={selectedDate} 
                  max={todayStr}
                  onChange={(e) => handleDateChange(e.target.value)} 
                  className="border border-charcoal bg-alabaster px-3 py-1 text-xs uppercase font-mono font-bold focus:outline-none h-[34px]"
                />
                {selectedDate !== todayStr && (
                  <button 
                    onClick={handleBackToToday} 
                    className="bg-charcoal text-alabaster border border-charcoal px-4 py-1 text-xs uppercase font-bold tracking-widest hover:bg-forest hover:border-forest transition-colors h-[34px]"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab Content Workspace */}
          <div className="min-h-[400px]">
            {activeTab === 'dashboard' && <Dashboard onNavigateToTab={handleTabChange} />}
            {activeTab === 'home' && <Home userLocation={userLocation} onNavigateToTab={handleTabChange} selectedDate={selectedDate} />}
            {activeTab === 'scam' && <ScamDetector />}
            {activeTab === 'docs' && <DocumentBrain />}
            {activeTab === 'decision' && <DecisionEngine onNavigateToTab={handleTabChange} />}
            {activeTab === 'finance' && <FinanceBrain selectedDate={selectedDate} />}
            {activeTab === 'health' && <HealthIntelligence selectedDate={selectedDate} />}
            {activeTab === 'goals' && <GoalEngine onNavigateToTab={handleTabChange} selectedDate={selectedDate} />}
            {!['dashboard', 'scam', 'home', 'docs', 'decision', 'finance', 'health', 'goals'].includes(activeTab) && (
              <div className="border border-charcoal border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <h3 className="text-xl font-serif font-bold text-charcoal/40 uppercase tracking-wider">
                  [ MODULE UNRESOLVED ]
                </h3>
                <p className="text-xs text-charcoal/50 font-sans mt-2 max-w-md">
                  This segment utilizes the shared `/copilot` backend reasoning endpoint.
                </p>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
