import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readDb, writeDb, calculateHealthScore, getUserGoogleTokens, saveUserGoogleTokens } from './healthDb.js';
import { authStorage } from './authStore.js';
import crypto from 'crypto';
import OrbitOrchestrator from './ai/orchestrator/OrbitOrchestrator.js';
import DecisionEngineService from './ai/decision/DecisionEngineService.js';
import DecisionContextBuilderService from './ai/decision/DecisionContextBuilderService.js';
import DecisionOrchestrator from './ai/decision/DecisionOrchestrator.js';
import MemoryService from './ai/memory/MemoryService.js';

import { db } from './db/index.js';
import * as dbSchema from './db/schema.js';
import { eq, and, not, inArray, desc } from 'drizzle-orm';



const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VAULT_DOCS = 100;

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  // Production Vercel frontend
  'https://orbit-6echd05ja-phanis-projects-1fd2babd.vercel.app',
  // Support any additional origins via env variable (comma-separated)
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : []),
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// ─── USER & SESSION STORAGE ──────────────────────────────────────────────────
let users = [];
let sessions = {};

const saveUsers = () => {
  // In-memory session alignment (no disk writes)
};

const saveSessions = () => {
  // In-memory session alignment (no disk writes)
};

// Manual cookie parser middleware
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      req.cookies[name] = val;
    });
  }
  next();
});

// AsyncLocalStorage context wrapper middleware
app.use((req, res, next) => {
  const sessionToken = req.cookies?.session_token || req.headers?.authorization?.split(' ')[1];
  const session = sessionToken ? sessions[sessionToken] : null;
  const store = session ? { userId: session.user.id } : {};
  authStorage.run(store, () => {
    next();
  });
});

// Auth protection middleware
const requireAuth = (req, res, next) => {
  const sessionToken = req.cookies?.session_token || req.headers?.authorization?.split(' ')[1];
  if (!sessionToken || !sessions[sessionToken]) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }
  req.user = sessions[sessionToken].user;
  req.userId = sessions[sessionToken].user.id;
  
  // Make sure the store context matches req.userId
  if (authStorage.getStore()?.userId !== req.userId) {
    authStorage.run({ userId: req.userId }, () => {
      next();
    });
  } else {
    next();
  }
};

// Global authentication guard middleware (fail-secure by default)
app.use((req, res, next) => {
  const publicPaths = [
    '/health',
    '/api/auth/signup',
    '/api/auth/login',
    '/api/auth/session',
    '/api/auth/logout',
    '/api/auth/google',
    '/api/auth/google/callback',
    '/auth/google',
    '/auth/google/callback',
    // Decision Engine routes handle their own Firebase token verification
    '/api/decision/analyze',
    '/api/decision',
    // Dev-only test session injection (disabled in production by the route handler itself)
    '/api/auth/test-session',
  ];
  
  if (
    publicPaths.includes(req.path) || 
    req.path.startsWith('/api/memory') || 
    req.path.startsWith('/decision') || 
    req.path.startsWith('/api/decision')
  ) {
    return next();
  }
  
  requireAuth(req, res, next);
});

// ─── AI CLIENT INITIALIZATION ────────────────────────────────────────────────

let anthropic = null;
let googleGenAI = null;

if (process.env.ANTHROPIC_API_KEY) {
  console.log('Anthropic API key detected. Initializing Claude client...');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

let orchestrator = null;

if (process.env.GEMINI_API_KEY) {
  console.log('Gemini API key detected. Initializing Gemini client...');
  googleGenAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  orchestrator = new OrbitOrchestrator(process.env.GEMINI_API_KEY);
} else {
  console.log('No Gemini API key detected. Initializing fallback OrbitOrchestrator...');
  orchestrator = new OrbitOrchestrator(null);
}

// Centralized AI orchestration wrapper
async function orchestrateAI(prompt, systemInstruction = '', options = {}) {
  if (!orchestrator) {
    throw new Error('AI Orchestrator not initialized.');
  }
  if (options.json || options.responseMimeType === 'application/json') {
    return await orchestrator.provider.generateStructured(prompt, systemInstruction, null, options);
  } else {
    return await orchestrator.provider.generate(prompt, systemInstruction, options);
  }
}

// ─── GOOGLE OAUTH CLIENT ─────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Calendar OAuth will be unavailable.');
}

// In-memory OAuth state mapping cache to prevent CSRF and identify starting users
const oauthStates = {}; // key: state token, value: { firebaseUid, referer, createdAt }

// Dynamically construct an authorized OAuth2 client for a specific user
const getOAuth2ClientForUser = async (firebaseUid) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  
  const tokens = await getUserGoogleTokens(firebaseUid);
  if (!tokens) return null;
  
  client.setCredentials(tokens);
  
  // Register a dynamic event listener to auto-persist refreshed access tokens to Neon PostgreSQL
  client.on('tokens', async (newTokens) => {
    console.log(`Google API client auto-refreshed credentials for Firebase user: ${firebaseUid}`);
    await saveUserGoogleTokens(firebaseUid, newTokens);
  });
  
  return client;
};

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    providers: {
      anthropic: !!anthropic,
      gemini: !!googleGenAI,
      googleCalendar: !!GOOGLE_CLIENT_ID
    }
  });
});

// ─── SHARED COPILOT ENDPOINT ─────────────────────────────────────────────────

app.post('/copilot', async (req, res) => {
  const { context, question, systemPrompt } = req.body;

  if (!context || !question || !systemPrompt) {
    return res.status(400).json({
      error: 'Missing required parameters: context, question, and systemPrompt are required.'
    });
  }

  // Fallback mode if no keys are configured
  if (!orchestrator || !orchestrator.provider.client) {
    console.warn('WARNING: No AI API keys are configured. Returning demo mock response.');
    const textToAnalyze = JSON.stringify(context).toLowerCase();
    let mockResponse;
    if (textToAnalyze.includes('scam') || textToAnalyze.includes('urgent') || textToAnalyze.includes('click') || textToAnalyze.includes('win') || textToAnalyze.includes('bank')) {
      mockResponse = {
        score: 85,
        summary: "[DEMO MODE] This looks highly suspicious.",
        reasons: ["Urgent call-to-action", "Suspicious external link"],
        actions: ["Do NOT click any links", "Delete the message"]
      };
    } else {
      mockResponse = {
        score: 5,
        summary: "[DEMO MODE] The message appears safe.",
        reasons: ["Casual phrasing", "No external links"],
        actions: ["Safe to respond if you recognize the sender"]
      };
    }
    return res.json(mockResponse);
  }

  try {
    const result = await orchestrator.handleRequest(req.body, req.userId);
    return res.json(result);
  } catch (error) {
    console.error('AI Orchestration error:', error.message);
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
      return res.status(429).json({
        error: 'Gemini API quota exceeded.',
        details: 'You have hit the free-tier daily request limit. Please wait a few minutes and try again, or generate a new API key at https://aistudio.google.com/app/apikey',
      });
    }
    return res.status(500).json({ error: 'Copilot processing error.', details: error.message });
  }
});

// ─── CORE AUTHENTICATION ROUTES (FIREBASE POWERED) ───────────────────────────
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyDEOWkX5vfkdibHzvfAGOsua8xAnkptn-8";

async function verifyFirebaseIdToken(idToken) {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (!res.ok) {
      const errData = await res.json();
      console.error('Firebase token verification HTTP error:', errData);
      return null;
    }
    const data = await res.json();
    if (data.users && data.users.length > 0) {
      return data.users[0];
    }
    return null;
  } catch (err) {
    console.error('Error verifying Firebase token:', err);
    return null;
  }
}

// Reusable helper to verify Bearer token (Firebase ID token or test session) and get user
async function verifyAndGetNeonUser(req) {
  const authHeader = req.headers.authorization;
  let rawToken = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7).trim();
  }
  if (!rawToken && req.cookies && req.cookies.session_token) {
    rawToken = req.cookies.session_token;
  }
  if (!rawToken) {
    return null;
  }

  let firebaseUid = null;
  const firebaseUser = await verifyFirebaseIdToken(rawToken);
  if (firebaseUser && firebaseUser.localId) {
    firebaseUid = firebaseUser.localId;
  } else if (sessions[rawToken]) {
    firebaseUid = sessions[rawToken].user?.id;
  }

  if (!firebaseUid) return null;
  return getNeonUser(firebaseUid);
}

// Session status check (GET)
app.get('/api/auth/session', (req, res) => {
  const sessionToken = req.cookies?.session_token || req.headers?.authorization?.split(' ')[1];
  const session = sessionToken ? sessions[sessionToken] : null;
  if (!session) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl
    }
  });
});

// Synchronize session state from Firebase Auth on the client (POST)
app.post('/api/auth/session', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Firebase ID Token is required.' });
  }

  const firebaseUser = await verifyFirebaseIdToken(idToken);
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
  }

  const firebaseUid = firebaseUser.localId;
  const email = firebaseUser.email.toLowerCase();
  
  // Find or create local user mapping
  let user = users.find(u => u.id === firebaseUid || u.email === email);
  if (!user) {
    user = {
      id: firebaseUid,
      name: firebaseUser.displayName || email.split('@')[0],
      email: email,
      authProvider: 'firebase',
      avatarUrl: firebaseUser.photoUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers();
    
    // Initialize the isolated user database with seed data
    await readDb(user.id);
  } else {
    // Keep user record aligned
    user.id = firebaseUid;
    if (firebaseUser.displayName) user.name = firebaseUser.displayName;
    if (firebaseUser.photoUrl) user.avatarUrl = firebaseUser.photoUrl;
    user.updatedAt = new Date().toISOString();
    saveUsers();
  }

  // Create local session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  sessions[sessionToken] = {
    user,
    createdAt: new Date().toISOString()
  };
  saveSessions();

  res.setHeader('Set-Cookie', `session_token=${sessionToken}; Path=/; Max-Age=${30 * 24 * 3600}; HttpOnly`);
  res.json({ success: true, authenticated: true, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const sessionToken = req.cookies?.session_token;
  if (sessionToken) {
    delete sessions[sessionToken];
    saveSessions();
  }
  res.setHeader('Set-Cookie', `session_token=; Path=/; Max-Age=0; HttpOnly`);
  res.json({ success: true });
});

// ─── DEV-ONLY: Test session injection ────────────────────────────────────────
//  This endpoint exists ONLY to support automated integration tests.
//  It creates a session entry in the server session store without requiring
//  a real Firebase ID token — useful for CI/CD and local dev testing.
//  It is completely disabled outside development mode.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/auth/test-session', (req, res) => {
    const { firebaseUid, sessionToken, name, email } = req.body;
    if (!firebaseUid || !sessionToken) {
      return res.status(400).json({ error: 'firebaseUid and sessionToken are required.' });
    }
    // Inject session directly — mirrors what /api/auth/session does after Firebase verification
    sessions[sessionToken] = {
      user: {
        id:       firebaseUid,
        name:     name  || 'Test User',
        email:    email || `${firebaseUid}@test.com`,
        authProvider: 'test',
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };
    console.log(`[DEV] Test session created for Firebase UID: ${firebaseUid}`);
    return res.json({ success: true, sessionToken });
  });
}


// ─── GOOGLE CALENDAR OAUTH ROUTES ────────────────────────────────────────────

// Step 1: Redirect user to Google consent screen
app.get('/auth/google', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(401).send('Authentication token required to connect Google Account.');
  }

  const firebaseUser = await verifyFirebaseIdToken(token);
  if (!firebaseUser) {
    return res.status(401).send('Invalid or expired authentication token.');
  }

  const firebaseUid = firebaseUser.localId;
  const referer = req.query.referer || req.headers.referer || 'http://localhost:5174/app';

  // Generate a cryptographically secure, random state token
  const state = crypto.randomBytes(32).toString('hex');
  
  // Cache the mapping between this state, user identity, and destination referer
  oauthStates[state] = {
    firebaseUid,
    referer,
    createdAt: Date.now()
  };

  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.body.read',
      'https://www.googleapis.com/auth/fitness.heart_rate.read',
      'https://www.googleapis.com/auth/fitness.sleep.read'
    ],
    prompt: 'consent',
    state: state
  });

  res.redirect(authUrl);
});

// Step 2: Google redirects back here with a code
app.get('/auth/google/callback', async (req, res) => {
  const { code, error, state } = req.query;
  
  // Retrieve the state mapping
  const stateData = state ? oauthStates[state] : null;
  if (!stateData) {
    return res.status(400).send('Invalid, expired, or missing OAuth state parameter. Please try again.');
  }

  // Clear state mapping from cache (single-use token check)
  delete oauthStates[state];

  const { firebaseUid, referer } = stateData;
  const finalUrl = new URL(referer);

  if (error) {
    console.error('Google authorization error:', error);
    finalUrl.searchParams.set('calendar', 'error');
    finalUrl.searchParams.set('reason', error);
    return res.redirect(finalUrl.toString());
  }

  try {
    const client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    const { tokens } = await client.getToken(code);
    
    // Save tokens securely in database associated with this Firebase Uid
    await saveUserGoogleTokens(firebaseUid, tokens);
    
    console.log(`Successfully completed Google OAuth and saved tokens for user: ${firebaseUid}`);
    
    finalUrl.searchParams.set('calendar', 'linked');
    res.redirect(finalUrl.toString());
  } catch (err) {
    console.error('Token exchange error:', err.message);
    finalUrl.searchParams.set('calendar', 'error');
    finalUrl.searchParams.set('reason', err.message);
    res.redirect(finalUrl.toString());
  }
});

// Step 3: Return today's calendar events as JSON
app.get('/calendar/events', async (req, res) => {
  const client = await getOAuth2ClientForUser(req.userId);
  if (!client) {
    // Return empty placeholder so the UI can handle the unlinked state gracefully
    return res.json({ linked: false, events: [] });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: client });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    });

    const events = (response.data.items || []).map(event => ({
      id: event.id,
      title: event.summary || 'Untitled Event',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || null,
      description: event.description || null,
      isAllDay: !event.start?.dateTime,
    }));

    return res.json({ linked: true, events });
  } catch (err) {
    console.error('Calendar fetch error:', err.message);

    const status = err.code || err.status;
    const errMsg = err.message || '';

    // Token expired or revoked
    if (status === 401 || errMsg.includes('invalid_grant') || errMsg.includes('token expired')) {
      await saveUserGoogleTokens(req.userId, null);
      return res.json({ linked: false, events: [], reason: 'token_expired', message: 'Your Google Calendar session expired. Please re-link.' });
    }

    // Calendar API not enabled in Google Cloud Console
    if (status === 403 || errMsg.includes('accessNotConfigured') || errMsg.includes('has not been used') || errMsg.includes('is disabled')) {
      return res.json({
        linked: false,
        events: [],
        reason: 'api_not_enabled',
        message: 'Google Calendar API is not enabled in your Cloud project. Enable it at: https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1002916332511'
      });
    }

    return res.status(500).json({ error: 'Failed to fetch calendar events.', details: err.message });
  }
});

// ─── WEATHER ENDPOINT (Open-Meteo, no key required) ──────────────────────────

app.get('/weather', async (req, res) => {
  // Default to Mumbai if no coordinates provided (demo persona per PRD)
  const lat = parseFloat(req.query.lat || '19.0760');
  const lon = parseFloat(req.query.lon || '72.8777');
  const city = req.query.city || 'Mumbai';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m&forecast_days=1&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);

    const data = await response.json();
    const current = data.current;

    // Map WMO weather codes to human-readable descriptions
    const weatherCodeMap = {
      0: 'Clear Sky', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Icy Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
      61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
      71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
      80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
      95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Heavy Thunderstorm'
    };

    const weatherDescription = weatherCodeMap[current.weather_code] || `Code ${current.weather_code}`;

    return res.json({
      city,
      lat,
      lon,
      temperature: Math.round(current.temperature_2m),
      unit: '°C',
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      condition: weatherDescription,
      weatherCode: current.weather_code,
      timestamp: current.time,
    });
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch weather data.', details: err.message });
  }
});

// ─── MORNING BRIEF ROUTES ──────────────────────────────────────────────────

// Helper to format steps, sleep, etc.
function formatSleepDuration(mins) {
  if (!mins) return '0h 0m';
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return `${hrs}h ${m}m`;
}

app.get('/home/dashboard', async (req, res) => {
  const db = await readDb(req.userId);
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];

  // Return cached brief if available in db.morningBriefs for the target date
  if (db.morningBriefs && db.morningBriefs[targetDateStr]) {
    return res.json(db.morningBriefs[targetDateStr]);
  }

  // Otherwise generate a new brief automatically
  await generateBriefInternal(req, res, db, targetDateStr);
});

app.post('/home/generate', async (req, res) => {
  const db = await readDb(req.userId);
  const targetDateStr = req.query.date || req.body.date || new Date().toISOString().split('T')[0];
  
  if (db.morningBriefs) {
    delete db.morningBriefs[targetDateStr];
  }
  
  await generateBriefInternal(req, res, db, targetDateStr, true);
});

// Centralized Morning Brief generation engine
async function generateBriefInternal(req, res, db, todayStr, forceRegen = false) {
  try {
    const healthScoreResult = calculateHealthScore(db, todayStr);
    const healthScore = healthScoreResult.score;
    
    // Finance Calculations scoped to the month of todayStr
    const finance = db.finance || { monthlyBudget: 28400, spent: 18700, remaining: 9700, billsDue: 2, recentExpenses: [], recurringBills: [] };
    const [selYear, selMonth] = todayStr.split('-').map(Number);
    const startOfMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}-01`;
    const endOfMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0')}`;
    const monthTransactions = (finance.transactions || []).filter(t => t.date >= startOfMonthStr && t.date <= endOfMonthStr);
    const monthSpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const financeScore = Math.round(Math.max(50, 100 - (monthSpent / finance.monthlyBudget * 40)));
    
    // Learning Calculations scoped to target date
    const learning = db.learning || { todayPlan: [], revisionReminders: [] };
    const datePlan = (learning.todayPlan || []).filter(p => p.date ? p.date === todayStr : todayStr === new Date().toISOString().split('T')[0]);
    const completedPlan = datePlan.filter(p => p.status === 'completed').length;
    const totalPlan = datePlan.length;
    const learningScore = totalPlan > 0 ? Math.round((completedPlan / totalPlan) * 30 + 70) : 92;
    
    // Goals Calculations
    const ge = db.goalEngine || { goals: [], habits: [] };
    const activeGoals = (ge.goals || []).filter(g => g.status === 'active');
    let goalsScore = 76;
    if (activeGoals.length > 0) {
      const totalProg = activeGoals.reduce((sum, g) => {
        const pct = g.unit === '%' ? g.currentValue : Math.min(100, Math.round((g.currentValue / g.targetValue) * 100));
        return sum + pct;
      }, 0);
      const avgProg = totalProg / activeGoals.length;
      const habits = ge.habits || [];
      const avgHabitRate = habits.length > 0 
        ? habits.reduce((sum, h) => sum + (h.completionRate || 0), 0) / habits.length
        : 70;
      goalsScore = Math.max(20, Math.min(100, Math.round((avgProg * 0.4) + (avgHabitRate * 0.6))));
    }

    const securityScore = db.security?.overallScore || 98;
    
    // Weighted overall score
    const overallLifeScore = Math.round((healthScore + financeScore + learningScore + goalsScore + securityScore) / 5);

    // Weather data (Default Mumbai)
    let weather = { condition: 'Clear', temperature: 28, unit: '°C' };
    try {
      const lat = req.query.lat || req.body.lat || 19.0760;
      const lon = req.query.lon || req.body.lon || 72.8777;
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const weatherRes = await fetch(weatherUrl);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        if (weatherData.current_weather) {
          const temp = Math.round(weatherData.current_weather.temperature);
          const code = weatherData.current_weather.weathercode;
          let cond = 'Clear';
          if (code >= 1 && code <= 3) cond = 'Partly Cloudy';
          else if (code >= 51 && code <= 67) cond = 'Raining';
          else if (code >= 71 && code <= 82) cond = 'Snowing';
          else if (code >= 95) cond = 'Thunderstorm';
          weather = { condition: cond, temperature: temp, unit: '°C' };
        }
      }
    } catch (wErr) {
      console.warn('Weather fetch failed for Morning Brief:', wErr.message);
    }

    // Google Calendar events
    let calendarEvents = [];
    const client = await getOAuth2ClientForUser(req.userId);
    if (client) {
      try {
        const calendar = google.calendar({ version: 'v3', auth: client });
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const calRes = await calendar.events.list({
          calendarId: 'primary',
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });
        calendarEvents = (calRes.data.items || []).map(item => ({
          title: item.summary,
          start: item.start.dateTime || item.start.date,
          isAllDay: !!item.start.date
        }));
      } catch (calErr) {
        console.warn('Calendar fetch failed for Morning Brief:', calErr.message);
      }
    }

    // Gather today's health values
    const todaySteps = db.step_logs.find(log => log.date === todayStr) || { count: 0 };
    const todaySleep = db.sleep_logs.find(log => log.date === todayStr) || { duration: 0 };
    const todayHR = db.heart_rate_logs.find(log => log.date === todayStr) || { bpm: 72 };
    const todayWater = db.water_logs.find(log => log.date === todayStr) || { amount: 0 };
    const todayWorkout = db.workout_logs.find(log => log.date === todayStr) || null;

    // Check if AI keys are configured
    const hasAIKeys = !!anthropic || !!googleGenAI;

    let briefResult;

    if (hasAIKeys) {
      try {
        const llmContext = {
          date: todayStr,
          weather,
          calendarEvents: calendarEvents.map(e => `${e.isAllDay ? 'All day' : e.start}: ${e.title}`),
          health: {
            steps: todaySteps.count,
            stepsGoal: 10000,
            sleepMins: todaySleep.duration,
            sleepGoalMins: 450,
            heartRateBpm: todayHR.bpm,
            waterMl: todayWater.amount,
            waterGoalMl: 3000,
            workoutCompleted: !!todayWorkout
          },
          finance: {
            monthlyBudget: finance.monthlyBudget,
            spent: finance.spent,
            remaining: finance.remaining,
            billsDue: finance.billsDue,
            recurringBills: finance.recurringBills
          },
          documents: db.documents || [],
          learning: {
            todayPlan: learning.todayPlan,
            revisionReminders: learning.revisionReminders
          },
          goalEngine: {
            goals: (ge.goals || []).map(g => ({
              title: g.title,
              category: g.category,
              progress: g.currentValue,
              target: g.targetValue,
              unit: g.unit,
              healthStatus: g.healthStatus,
              successProbability: g.successProbability,
              nextAction: g.nextAction
            })),
            habits: (ge.habits || []).map(h => ({
              title: h.title,
              frequency: h.frequency,
              completionRate: h.completionRate,
              currentStreak: h.currentStreak
            }))
          },
          dailyChallenge: db.dailyChallenge
        };

        const systemPrompt = `
You are Orbit's Morning Brief reasoning core. Return a personalized greeting, a warm welcoming sentence based on context, top 3 priorities for today, and 3-5 actionable recommendations.
Order priorities by urgency (due date, importance).
Ensure recommendations are highly personalized and refer to the specific numbers in health, finance, learning, or documents (e.g. refer to the interview time, specific bill amount, sleep hours, or remaining budget).
Return ONLY valid JSON in this exact structure:
{
  "greeting": "Good Morning, Sai",
  "welcomeSentence": "<warm narrative sentence based on sleep, weather, calendar density. E.g. 'You've slept well. Today looks productive.'>",
  "priorities": [
    { "title": "<task/event>", "time": "<due time or relative window>", "urgency": "High"|"Medium"|"Low" },
    ...3 priorities
  ],
  "recommendations": [
    "<actionable recommendation 1>",
    "<actionable recommendation 2>",
    ...3-5 recommendations
  ]
}
`;

        const promptText = `
Context Data:
${JSON.stringify(llmContext, null, 2)}

System Instruction:
${systemPrompt}

IMPORTANT: Return ONLY raw JSON. No markdown backticks.
`;

        let responseText = '';
        if (anthropic) {
          const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            temperature: 0.1,
            system: "You are the Orbit reasoning core. Return only a JSON object. No markdown.",
            messages: [{ role: 'user', content: promptText }],
          });
          responseText = message.content[0].text;
        } else if (googleGenAI) {
          responseText = await orchestrateAI(promptText, "You are the Orbit reasoning core. Return only a JSON object. No markdown.", { temperature: 0.1 });
        }

        try {
          let cleanText = responseText.trim();
          if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
          else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
          if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
          
          const aiParsed = JSON.parse(cleanText.trim());
          briefResult = {
            date: todayStr,
            greeting: aiParsed.greeting || 'Good Morning, Sai',
            welcomeSentence: aiParsed.welcomeSentence || "Here is your overview for today.",
            score: overallLifeScore,
            breakdown: {
              health: healthScore,
              finance: financeScore,
              learning: learningScore,
              goals: goalsScore,
              security: securityScore
            },
            priorities: aiParsed.priorities || [],
            recommendations: aiParsed.recommendations || []
          };
        } catch (parseErr) {
          console.warn('AI JSON parsing failed for Morning Brief, using fallback template:', parseErr.message);
        }
      } catch (aiErr) {
        console.warn('AI brief generation failed, using fallback:', aiErr.message);
        briefResult = null;
      }
    }

    if (!briefResult) {
      // 1. Dynamic Greeting based on current hour & profile name
      const userName = db.profile?.name || 'Sai';
      const currentHour = new Date().getHours();
      let greeting = `Good Morning, ${userName}`;
      if (currentHour >= 12 && currentHour < 17) {
        greeting = `Good Afternoon, ${userName}`;
      } else if (currentHour >= 17 && currentHour < 22) {
        greeting = `Good Evening, ${userName}`;
      } else if (currentHour >= 22 || currentHour < 5) {
        greeting = `Good Night, ${userName}`;
      }

      // 2. Dynamic Welcome Sentence
      let welcomeSentence = "Here is your overview for today.";
      if (todaySleep.duration < 420 && todaySleep.duration > 0) {
        welcomeSentence = `Your sleep was short at ${formatSleepDuration(todaySleep.duration)}, but your schedule is manageable today.`;
      } else if (calendarEvents.length > 2) {
        welcomeSentence = `You have a focused day ahead with ${calendarEvents.length} events scheduled.`;
      } else if (weather && weather.condition && weather.condition.toLowerCase().includes('rain')) {
        welcomeSentence = `Expect rain in ${weather.city || 'your area'} today. Perfect opportunity for focused indoor deep work.`;
      } else if (goalsScore > 85) {
        welcomeSentence = "Your goals and habits are progressing exceptionally well this week.";
      } else {
        welcomeSentence = "Your calendar is light today. Excellent opportunity to focus on your primary goals.";
      }

      // 3. Dynamic Priorities
      const priorities = [];
      
      // A. Calendar Events
      calendarEvents.forEach(e => {
        priorities.push({
          title: e.title,
          time: e.isAllDay ? 'All Day' : new Date(e.start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          urgency: 'High'
        });
      });

      // B. Active goals behind or at risk
      const activeGoalsList = ge.goals || [];
      activeGoalsList.forEach(g => {
        if (g.status === 'active' && (g.healthStatus === 'behind' || g.healthStatus === 'at_risk')) {
          priorities.push({
            title: `Replan Goal: ${g.title || g.name}`,
            time: 'Goal Engine',
            urgency: 'High'
          });
        }
      });

      // C. Unpaid bills due today or tomorrow
      const bills = finance.recurringBills || [];
      bills.forEach(b => {
        if (b.status === 'unpaid') {
          priorities.push({
            title: `Pay Bill: ${b.name}`,
            time: b.dueDate === todayStr ? 'Today' : 'Upcoming',
            urgency: b.dueDate === todayStr ? 'High' : 'Medium'
          });
        }
      });

      // D. Expiring documents
      const docs = db.documents || [];
      docs.forEach(d => {
        if (d.status && (d.status.includes('Month') || d.status.includes('Renewal'))) {
          priorities.push({
            title: `Renew Doc: ${d.name}`,
            time: d.expiryDate || 'Upcoming',
            urgency: 'Medium'
          });
        }
      });

      // E. Pending study goals
      const studyPlan = learning.todayPlan || [];
      studyPlan.forEach(p => {
        if (p.status === 'pending') {
          priorities.push({
            title: `Study: ${p.subject}`,
            time: `${p.durationMins}m`,
            urgency: 'Medium'
          });
        }
      });

      // Sort priorities: High first, then Medium, then Low
      const urgencyWeights = { High: 3, Medium: 2, Low: 1 };
      priorities.sort((a, b) => (urgencyWeights[b.urgency] || 0) - (urgencyWeights[a.urgency] || 0));

      if (priorities.length === 0) {
        priorities.push({
          title: 'Plan Your Weekly Milestones',
          time: 'Morning Routine',
          urgency: 'Medium'
        });
      }

      // 4. Dynamic Recommendations
      const recommendations = [];

      // A. Sleep recommendation
      if (todaySleep.duration > 0 && todaySleep.duration < 450) {
        recommendations.push(`Sleep has been below target (${formatSleepDuration(todaySleep.duration)}). Try going to bed before 11 PM tonight.`);
      } else if (todaySleep.duration >= 450) {
        recommendations.push('Excellent sleep restoration detected. Use this energy for deep focus sessions today.');
      }

      // B. Steps recommendation
      if (todaySteps.count > 0 && todaySteps.count < 10000) {
        recommendations.push(`Walk another ${Math.max(0, 10000 - todaySteps.count).toLocaleString()} steps to achieve today's goal.`);
      } else if (todaySteps.count >= 10000) {
        recommendations.push('Daily step target of 10,000 steps reached. Keep moving!');
      }

      // C. Hydration recommendation
      if (todayWater.amount > 0 && todayWater.amount < 3000) {
        recommendations.push(`Drink another ${Math.max(0, 3000 - todayWater.amount)} mL of water to reach your daily hydration target.`);
      } else if (todayWater.amount >= 3000) {
        recommendations.push('Daily hydration target of 3.0L completed. Great work!');
      }

      // D. Budget warning
      const budgetPct = Math.round((finance.spent / finance.monthlyBudget) * 100);
      if (budgetPct >= 80) {
        recommendations.push(`Monthly spending is at ${budgetPct}% of your limit. Consider curbing non-essential purchases.`);
      } else {
        recommendations.push(`You are on track to stay within your monthly budget of ₹${finance.monthlyBudget.toLocaleString()}.`);
      }

      // E. Unused Subscription warning
      const unusedSub = (finance.subscriptions || []).find(s => s.lastUsedDaysAgo > 30);
      if (unusedSub) {
        recommendations.push(`Vault detected unused "${unusedSub.name}" subscription last used ${unusedSub.lastUsedDaysAgo} days ago. Save ₹${unusedSub.amount} by cancelling.`);
      }

      // F. Pending study modules
      const pendingStudy = studyPlan.filter(p => p.status === 'pending');
      if (pendingStudy.length > 0) {
        recommendations.push(`You have ${pendingStudy.length} study goals pending. Block out 1 hour for DSA practice.`);
      }

      briefResult = {
        date: todayStr,
        greeting,
        welcomeSentence,
        score: overallLifeScore,
        breakdown: {
          health: healthScore,
          finance: financeScore,
          learning: learningScore,
          goals: goalsScore,
          security: securityScore
        },
        priorities: priorities.slice(0, 4),
        recommendations: recommendations.slice(0, 5)
      };
    }

    const responsePayload = {
      ...briefResult,
      healthSnapshot: {
        sleep: formatSleepDuration(todaySleep.duration),
        steps: todaySteps.count.toLocaleString(),
        heartRate: `${todayHR.bpm} bpm`,
        water: `${((todayWater.amount || 0) / 1000).toFixed(1)} L`,
        workout: todayWorkout ? 'Completed' : 'Pending'
      },
      financeSnapshot: {
        monthlyBudget: `₹${finance.monthlyBudget.toLocaleString()}`,
        spent: `₹${finance.spent.toLocaleString()}`,
        remaining: `₹${finance.remaining.toLocaleString()}`,
        billsDue: finance.billsDue,
        note: finance.spent > finance.monthlyBudget * 0.7 
          ? "Lifestyle spending is elevated. Exercise caution on non-essential purchases."
          : "You're on track to stay within your monthly budget if spending remains consistent."
      },
      calendarSnapshot: calendarEvents.slice(0, 3).map(e => ({
        time: e.isAllDay ? 'All Day' : new Date(e.start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        title: e.title
      })),
      documentsSnapshot: (db.documents || []).map(d => ({
        name: d.name,
        status: d.status
      })),
      learningSnapshot: (learning.todayPlan || []).map(p => ({
        subject: p.subject.split(' ')[0],
        duration: p.durationMins >= 60 ? `${Math.round(p.durationMins/60)} Hour` : `${p.durationMins} Minutes`
      })),
      dailyChallenge: db.dailyChallenge || { title: 'Walk 10,000 Steps', reward: '+5 Health Score' },
      reflectionPreview: {
        title: "Tonight Orbit will summarize:",
        bullets: [
          "Health logs & Sleep quality",
          "Day's expenses vs daily allowance",
          "Productivity & Learning progress",
          "Tomorrow's scheduling prep"
        ]
      }
    };

    if (!db.morningBriefs) db.morningBriefs = {};
    db.morningBriefs[todayStr] = responsePayload;

    if (!db.dailyLifeSnapshots) db.dailyLifeSnapshots = {};
    db.dailyLifeSnapshots[todayStr] = {
      id: 'snap_' + Math.random().toString(36).substr(2, 9),
      date: todayStr,
      life_score: overallLifeScore,
      health_score: healthScore,
      finance_score: financeScore,
      goals_score: goalsScore,
      security_score: securityScore,
      learning_score: learningScore,
      summary: responsePayload.welcomeSentence,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await writeDb(req.userId, db, true);
    res.json(responsePayload);

  } catch (err) {
    console.error('Failed to generate morning brief:', err);
    res.status(500).json({ error: 'failed_generation', message: err.message });
  }
}

// ─── HEALTH INTELLIGENCE ROUTES ──────────────────────────────────────────────

// All /health routes require authentication
app.use('/health', requireAuth);

// Helper to get formatted current time in HH:MM format
function getFormattedTime() {
  const now = new Date();
  return now.toTimeString().split(' ')[0].substring(0, 5);
}

// Route: Get dashboard state
app.get('/health/dashboard', async (req, res) => {
  const db = await readDb(req.userId);
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
  const scoreInfo = calculateHealthScore(db, targetDateStr);
  
  // Fetch target date's records
  const targetSteps = db.step_logs.find(log => log.date === targetDateStr) || { count: 0, distance: 0, calories: 0 };
  const targetSleep = db.sleep_logs.find(log => log.date === targetDateStr) || { duration: 0, deep: 0, rem: 0, light: 0 };
  const targetHR = db.heart_rate_logs.find(log => log.date === targetDateStr) || null;
  const targetWater = db.water_logs.find(log => log.date === targetDateStr) || { amount: 0 };
  const targetWorkout = db.workout_logs.find(log => log.date === targetDateStr) || null;

  // Compile daily summary
  const dailySummary = {
    steps: { current: targetSteps.count, target: 10000 },
    sleep: { current: targetSleep.duration, target: 450 },
    heartRate: targetHR ? targetHR.bpm : 0,
    calories: (targetSteps.calories || 0) + (targetWorkout ? targetWorkout.calories : 0),
    water: (targetWater.amount || 0) / 1000, // in Litres
    workout: targetWorkout ? targetWorkout.duration : 0
  };

  // Compile recommendations dynamically
  const recommendations = [...db.recommendations];
  
  // Add steps recommendation if below target
  if (targetSteps.count < 10000) {
    const diff = 10000 - targetSteps.count;
    if (!recommendations.some(r => r.id === 'rec_steps')) {
      recommendations.push({ id: 'rec_steps', text: `Walk ${diff} more steps to reach today's goal.`, completed: false });
    }
  }
  
  // Add water recommendation if below target
  if (targetWater.amount < 3000) {
    const diff = 3000 - targetWater.amount;
    if (!recommendations.some(r => r.id === 'rec_water')) {
      recommendations.push({ id: 'rec_water', text: `Drink another ${diff} mL of water to hit your target.`, completed: false });
    }
  }

  // Add workout recommendation if no workout logged in 3 days
  const hasRecentWorkout = db.workout_logs.some(log => {
    const logDate = new Date(log.date);
    const diffTime = Math.abs(new Date() - logDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });
  if (!hasRecentWorkout && !recommendations.some(r => r.id === 'rec_workout')) {
    recommendations.push({ id: 'rec_workout', text: "You've skipped workouts for three days. A light 20-minute walk could help you get back on track.", completed: false });
  }

  // Filter timeline events for target date
  const filteredTimeline = (db.timeline || []).filter(e => e.date ? e.date === targetDateStr : targetDateStr === new Date().toISOString().split('T')[0]);

  // Calculate dynamic scoreDiff vs 7 days ago
  const lastWeekDate = new Date(targetDateStr);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekDateStr = lastWeekDate.toISOString().split('T')[0];
  const lastWeekScore = calculateHealthScore(db, lastWeekDateStr).score;
  const scoreDelta = scoreInfo.score - lastWeekScore;
  const scoreDiffStr = scoreDelta > 0
    ? `+${scoreDelta} vs last week`
    : scoreDelta < 0
      ? `${scoreDelta} vs last week`
      : 'Same as last week';

  res.json({
    healthScore: scoreInfo.score,
    scoreDiff: scoreDiffStr,
    scoreRating: scoreInfo.score >= 80 ? 'Excellent' : scoreInfo.score >= 60 ? 'Good' : 'Needs Work',
    components: scoreInfo.components,
    dailySummary,
    timeline: filteredTimeline,
    recommendations,
    insights: db.insights,
    profile: db.profile
  });
});

// Route: Get historical charts metrics
app.get('/health/metrics', async (req, res) => {
  const db = await readDb(req.userId);
  
  // Sort logs by date to ensure proper timeline chart ordering
  const sortedSteps = [...db.step_logs].sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
  const sortedSleep = [...db.sleep_logs].sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
  const sortedHR = [...db.heart_rate_logs].sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
  const sortedWeight = [...db.weight_logs].sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
  const sortedWater = [...db.water_logs].sort((a,b) => a.date.localeCompare(b.date)).slice(-7);

  const dates = sortedSteps.map(log => log.date);

  // Map to historical arrays
  const metrics = {
    dates,
    steps: sortedSteps.map(log => log.count),
    sleep: sortedSleep.map(log => Math.round((log.duration / 60) * 10) / 10), // in hours, 1 decimal
    sleepDetails: sortedSleep.map(log => ({ deep: log.deep, rem: log.rem, light: log.light })),
    heartRate: sortedHR.map(log => log.bpm),
    weight: sortedWeight.map(log => log.weight),
    water: sortedWater.map(log => Math.round((log.amount / 1000) * 10) / 10) // in Litres
  };

  res.json(metrics);
});

// Route: Connect Fit & Health Connect (Sync Simulation)
app.post('/health/connect/:provider', async (req, res) => {
  const { provider } = req.params;
  const db = await readDb(req.userId);
  const todayStr = new Date().toISOString().split('T')[0];

  if (provider === 'google-fit') {
    db.profile.connectedGoogleFit = true;
    
    // Simulate syncing: set today's steps, sleep, hr, and workout to completed values
    let stepsToday = db.step_logs.find(l => l.date === todayStr);
    if (!stepsToday) {
      stepsToday = { date: todayStr, count: 0, distance: 0, calories: 0, source: 'google-fit' };
      db.step_logs.push(stepsToday);
    }
    stepsToday.count = 9432;
    stepsToday.distance = 7100;
    stepsToday.calories = 2150;
    
    let sleepToday = db.sleep_logs.find(l => l.date === todayStr);
    if (!sleepToday) {
      sleepToday = { date: todayStr, duration: 0, deep: 0, rem: 0, light: 0, source: 'google-fit' };
      db.sleep_logs.push(sleepToday);
    }
    sleepToday.duration = 445; // 7.4 hours
    sleepToday.deep = 95;
    sleepToday.rem = 100;
    sleepToday.light = 250;

    let hrToday = db.heart_rate_logs.find(l => l.date === todayStr);
    if (!hrToday) {
      hrToday = { date: todayStr, bpm: 72, source: 'google-fit' };
      db.heart_rate_logs.push(hrToday);
    }
    hrToday.bpm = 69;

    let workoutToday = db.workout_logs.find(l => l.date === todayStr);
    if (!workoutToday) {
      workoutToday = { date: todayStr, type: 'Cardio Gym', duration: 45, calories: 350, source: 'google-fit' };
      db.workout_logs.push(workoutToday);
    }

    // Add to timeline
    db.timeline.unshift({
      time: getFormattedTime(),
      text: 'Synchronized steps, sleep, heart rate, and workouts from Google Fit.',
      type: 'sync'
    });

  } else if (provider === 'health-connect') {
    db.profile.connectedHealthConnect = true;

    // Simulate syncing: set today's steps, sleep, weight to active values
    let stepsToday = db.step_logs.find(l => l.date === todayStr);
    if (!stepsToday) {
      stepsToday = { date: todayStr, count: 0, distance: 0, calories: 0, source: 'health-connect' };
      db.step_logs.push(stepsToday);
    }
    stepsToday.count = 10250; // met target!
    stepsToday.distance = 7850;
    stepsToday.calories = 2210;

    db.timeline.unshift({
      time: getFormattedTime(),
      text: 'Synchronized activity telemetry from Health Connect.',
      type: 'sync'
    });
  }

  await writeDb(req.userId, db);
  res.json({ status: 'success', profile: db.profile });
});

// Route: Real or Mock Health Data Sync
// Route: Real Health Data Sync (Google Fit)
app.post('/health/sync', async (req, res) => {
  const { type } = req.body;
  const db = await readDb(req.userId);
  const todayStr = new Date().toISOString().split('T')[0];

  if (type !== 'real') {
    return res.status(400).json({ error: 'invalid_type', message: 'Only real synchronization is supported.' });
  }

  const client = await getOAuth2ClientForUser(req.userId);
  if (!client) {
    return res.status(401).json({
      error: 'unlinked',
      message: 'Google Account is not linked. Please connect your Google Account first to grant permissions.'
    });
  }

  try {
    const fitness = google.fitness({ version: 'v1', auth: client });

    const now = new Date();
    const endTime = now.getTime();
    const startTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    // 1. Fetch steps from com.google.step_count.delta
    console.log(`[Google Fit Sync] Fetching steps for user ${req.userId}...`);
    const stepsResponse = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime,
        endTimeMillis: endTime
      }
    });

    // 2. Fetch sleep sessions
    console.log(`[Google Fit Sync] Fetching sleep sessions for user ${req.userId}...`);
    const sleepResponse = await fitness.users.sessions.list({
      userId: 'me',
      activityType: 72, // Sleep
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString()
    });

    // 3. Fetch heart rate
    console.log(`[Google Fit Sync] Fetching heart rate for user ${req.userId}...`);
    const hrResponse = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime,
        endTimeMillis: endTime
      }
    });

    // Map dates for the last 7 days
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    // Process Steps
    const fitSteps = [];
    if (stepsResponse?.data?.bucket) {
      stepsResponse.data.bucket.forEach((bucket, idx) => {
        const dateStr = dates[idx] || new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
        let count = 0;
        if (bucket.dataset?.[0]?.point) {
          bucket.dataset[0].point.forEach(pt => {
            if (pt.value?.[0]) {
              count += pt.value[0].intVal || Math.round(pt.value[0].fpVal || 0);
            }
          });
        }
        fitSteps.push({
          date: dateStr,
          count: count,
          distance: Math.round(count * 0.75),
          calories: Math.round(count * 0.04) + 1800,
          source: 'google-fit-real'
        });
      });
    }

    // Process Heart Rate
    const fitHR = [];
    if (hrResponse?.data?.bucket) {
      hrResponse.data.bucket.forEach((bucket, idx) => {
        const dateStr = dates[idx] || new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
        let bpmSum = 0;
        let bpmCount = 0;
        if (bucket.dataset?.[0]?.point) {
          bucket.dataset[0].point.forEach(pt => {
            if (pt.value?.[0]) {
              bpmSum += pt.value[0].fpVal || pt.value[0].intVal || 0;
              bpmCount++;
            }
          });
        }
        const bpm = bpmCount > 0 ? Math.round(bpmSum / bpmCount) : 0;
        fitHR.push({
          date: dateStr,
          bpm,
          source: 'google-fit-real'
        });
      });
    }

    // Process Sleep
    const fitSleep = [];
    const sleepSessions = sleepResponse?.data?.session || [];
    dates.forEach(dateStr => {
      const sess = sleepSessions.find(s => {
        const sDate = new Date(parseInt(s.startTimeMillis)).toISOString().split('T')[0];
        return sDate === dateStr;
      });
      if (sess) {
        const duration = Math.round((parseInt(sess.endTimeMillis) - parseInt(sess.startTimeMillis)) / 60000);
        fitSleep.push({
          date: dateStr,
          duration,
          deep: Math.round(duration * 0.22),
          rem: Math.round(duration * 0.20),
          light: Math.round(duration * 0.58),
          source: 'google-fit-real'
        });
      } else {
        fitSleep.push({
          date: dateStr,
          duration: 0,
          deep: 0,
          rem: 0,
          light: 0,
          source: 'google-fit-real'
        });
      }
    });

    // Save to database
    if (fitSteps.length > 0) {
      fitSteps.forEach(fs => {
        const i = db.step_logs.findIndex(l => l.date === fs.date);
        if (i !== -1) db.step_logs[i] = fs;
        else db.step_logs.push(fs);
      });
    }
    if (fitHR.length > 0) {
      fitHR.forEach(fh => {
        const i = db.heart_rate_logs.findIndex(l => l.date === fh.date);
        if (i !== -1) db.heart_rate_logs[i] = fh;
        else db.heart_rate_logs.push(fh);
      });
    }
    if (fitSleep.length > 0) {
      fitSleep.forEach(fsl => {
        const i = db.sleep_logs.findIndex(l => l.date === fsl.date);
        if (i !== -1) db.sleep_logs[i] = fsl;
        else db.sleep_logs.push(fsl);
      });
    }

    db.profile.connectedGoogleFit = true;
    db.timeline.unshift({
      time: getFormattedTime(),
      text: 'Synchronized steps, sleep, and heart rate telemetry from Google Fit.',
      type: 'sync'
    });

    await writeDb(req.userId, db);
    res.json({ status: 'success', synced: true, source: 'real', profile: db.profile });

  } catch (err) {
    console.error('[Google Fit Sync Error]:', err);
    let errMsg = err.message || '';
    
    if (err.code === 403 || errMsg.toLowerCase().includes('scope') || errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('disabled') || errMsg.toLowerCase().includes('not been used')) {
      errMsg = 'Fitness API has not been enabled or lacks permissions. Please visit https://console.developers.google.com/apis/api/fitness.googleapis.com/overview?project=1002916332511 to enable it in your Google Cloud Console, and ensure you check all checkboxes during authorization.';
    }

    db.timeline.unshift({
      time: getFormattedTime(),
      text: `Google Fit synchronization failed: ${errMsg}`,
      type: 'sync-error'
    });
    await writeDb(req.userId, db);

    res.status(500).json({
      error: 'sync_failed',
      message: errMsg
    });
  }
});

// Route: Manual Data Entry
app.post('/health/manual-entry', async (req, res) => {
  const { type, value, medicationId, date } = req.body;
  const db = await readDb(req.userId);
  const todayStr = date || new Date().toISOString().split('T')[0];
  const timeStr = getFormattedTime();

  if (!type || value === undefined) {
    return res.status(400).json({ error: 'Missing type or value' });
  }

  if (type === 'weight') {
    const wtVal = parseFloat(value);
    db.profile.weight = wtVal;
    let wtLog = db.weight_logs.find(l => l.date === todayStr);
    if (wtLog) {
      wtLog.weight = wtVal;
    } else {
      db.weight_logs.push({ date: todayStr, weight: wtVal });
    }
    // Update goal current value
    const wtGoal = db.goals.find(g => g.type === 'weight');
    if (wtGoal) wtGoal.currentValue = wtVal;

    db.timeline.unshift({ date: todayStr, time: timeStr, text: `Logged weight manually: ${wtVal} kg`, type: 'weight' });

  } else if (type === 'water') {
    const waterVal = parseInt(value);
    let waterLog = db.water_logs.find(l => l.date === todayStr);
    if (waterLog) {
      waterLog.amount += waterVal;
    } else {
      waterLog = { date: todayStr, amount: waterVal };
      db.water_logs.push(waterLog);
    }
    // Update goal
    const waterGoal = db.goals.find(g => g.type === 'water');
    if (waterGoal) waterGoal.currentValue = waterLog.amount;

    db.timeline.unshift({ date: todayStr, time: timeStr, text: `Logged water intake: +${waterVal} mL (${(waterLog.amount / 1000).toFixed(1)}L total)`, type: 'water' });

  } else if (type === 'bloodPressure') {
    db.profile.bloodPressure = value;
    db.timeline.unshift({ date: todayStr, time: timeStr, text: `Logged blood pressure manually: ${value}`, type: 'medical' });

  } else if (type === 'bloodSugar') {
    const bsVal = parseInt(value);
    db.profile.bloodSugar = bsVal;
    db.timeline.unshift({ date: todayStr, time: timeStr, text: `Logged blood sugar manually: ${bsVal} mg/dL`, type: 'medical' });

  } else if (type === 'mood') {
    db.timeline.unshift({ date: todayStr, time: timeStr, text: `Logged daily mood state: ${value}`, type: 'mood' });

  } else if (type === 'medication') {
    const med = db.medications.find(m => m.id === medicationId);
    if (med) {
      if (!med.history) med.history = {};
      med.history[todayStr] = !!value; // true/false
      
      // Manage refill count decrement
      if (value && med.refillCount > 0) {
        med.refillCount = Math.max(0, med.refillCount - 1);
      }

      db.timeline.unshift({
        date: todayStr,
        time: timeStr,
        text: value ? `Logged medication dose taken: ${med.name}` : `Dose missed/untaken: ${med.name}`,
        type: 'medication'
      });
    }
  }

  await writeDb(req.userId, db);
  res.json({ status: 'success', scoreInfo: calculateHealthScore(db, todayStr) });
});

// Route: Get goals list
app.get('/health/goals', async (req, res) => {
  const db = await readDb(req.userId);
  res.json(db.goals);
});

// Route: Create or update goal
app.put('/health/goals', async (req, res) => {
  const { goals } = req.body;
  const db = await readDb(req.userId);
  if (Array.isArray(goals)) {
    db.goals = goals;
    await writeDb(req.userId, db);
    return res.json({ status: 'success', goals: db.goals });
  }
  res.status(400).json({ error: 'Goals must be an array' });
});

// Route: Get timeline events
app.get('/health/timeline', async (req, res) => {
  const db = await readDb(req.userId);
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
  const filteredTimeline = (db.timeline || []).filter(e => e.date ? e.date === targetDateStr : targetDateStr === new Date().toISOString().split('T')[0]);
  res.json(filteredTimeline);
});

// Route: Get recommendations
app.get('/health/recommendations', async (req, res) => {
  const db = await readDb(req.userId);
  res.json(db.recommendations);
});

// Route: Get medications
app.get('/health/medications', async (req, res) => {
  const db = await readDb(req.userId);
  res.json(db.medications);
});

// Route: Add medication
app.post('/health/medications', async (req, res) => {
  const { name, dosage, frequency, refillReminder, refillCount } = req.body;
  const db = await readDb(req.userId);
  
  if (!name || !dosage) {
    return res.status(400).json({ error: 'Medication name and dosage are required' });
  }

  const newMed = {
    id: 'm_' + Date.now(),
    name,
    dosage,
    frequency: frequency || 'Daily',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    refillReminder: !!refillReminder,
    refillCount: refillCount !== undefined ? parseInt(refillCount) : 30,
    history: {}
  };

  db.medications.push(newMed);
  
  db.timeline.unshift({
    time: getFormattedTime(),
    text: `New medication added: ${name} (${dosage}, ${newMed.frequency})`,
    type: 'medication'
  });

  await writeDb(req.userId, db);
  res.json({ status: 'success', medication: newMed });
});

// Route: Refill medication
app.post('/health/medications/:id/refill', async (req, res) => {
  const { id } = req.params;
  const { count } = req.body;
  const db = await readDb(req.userId);
  const med = db.medications.find(m => m.id === id);
  if (med) {
    med.refillCount = (med.refillCount || 0) + parseInt(count || 30);
    db.timeline.unshift({
      time: getFormattedTime(),
      text: `Refilled medication supply: ${med.name} (+${count || 30} doses)`,
      type: 'medication'
    });
    await writeDb(req.userId, db);
    return res.json({ status: 'success', medication: med });
  }
  res.status(404).json({ error: 'Medication not found' });
});

// Route: Upload PDF/Image Blood Test OCR Analysis
app.post('/health/report/upload', async (req, res) => {
  const { fileBase64, fileName, fileType } = req.body;

  if (!fileBase64) {
    return res.status(400).json({ error: 'Missing fileBase64 upload payload' });
  }

  const promptText = `
You are Orbit's Medical intelligence engine. You will be provided with a medical report, blood test, prescription, or clinical lab result.
Parse the document and extract key metrics.
Return your response STRICTLY as a JSON object with the following fields (no markdown wrapper, no conversational text):
{
  "summary": "Brief 2-3 sentence layperson summary of the document, what it is, and the overall clinical findings. IMPORTANT: You must start and end this summary with a clear disclaimer that this is an AI interpretation and NOT a professional medical diagnosis.",
  "keyValues": ["List of key biomarker or laboratory values extracted, e.g., Hemoglobin: 14.2 g/dL, Vitamin D: 32 ng/mL"],
  "abnormalValues": ["List of values that are flagged as high, low, or out of normal reference ranges, e.g., LDL Cholesterol: 145 mg/dL (High)"],
  "doctorQuestions": ["List of 3-4 constructive, helpful questions the user can ask their doctor during their next visit based on these results"],
  "score": 85
}
`;

  // Fallback mode if no keys are configured
  if (!anthropic && !googleGenAI) {
    console.warn('WARNING: No AI API keys are configured. Returning demo mock response for medical report.');
    const db = await readDb(req.userId);
    const demoReport = {
      id: 'rep_' + Date.now(),
      fileName: fileName || 'Blood_Report.pdf',
      uploadDate: new Date().toISOString().split('T')[0],
      summary: "This is an AI summary of your lab blood panel. Disclaimer: This report is a simulation for testing purposes and does not represent a medical diagnosis. Please consult a qualified health provider.",
      keyValues: [
        "Hemoglobin: 14.5 g/dL (Normal)",
        "Fasting Blood Sugar: 98 mg/dL (Normal)",
        "Total Cholesterol: 195 mg/dL (Normal)",
        "Vitamin D: 26 ng/mL (Low)"
      ],
      abnormalValues: [
        "Vitamin D: 26 ng/mL (Reference: >30 ng/mL - Low)"
      ],
      doctorQuestions: [
        "Is my Vitamin D level low enough to warrant a prescription-strength supplement?",
        "Should we run a full bone density panel or calcium tests?",
        "When should we re-test my blood to verify Vitamin D absorption?"
      ],
      score: 80
    };

    db.medical_reports.unshift(demoReport);
    db.timeline.unshift({
      time: getFormattedTime(),
      text: `Uploaded and parsed medical report: ${fileName || 'Blood_Report.pdf'} (Demo Mode)`,
      type: 'medical'
    });
    await writeDb(req.userId, db);

    return res.json(demoReport);
  }

  try {
    let responseText = '';

    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.1,
        system: "You are Orbit's medical analysis core. Return only a JSON object. No markdown.",
        messages: [{ role: 'user', content: promptText }],
      });
      responseText = message.content[0].text;
    } else if (googleGenAI) {
      const parts = [
        { text: promptText },
        { inlineData: { data: fileBase64, mimeType: fileType || 'application/pdf' } }
      ];
      responseText = await orchestrateAI(parts, "You are the Orbit medical analysis core. Return only a JSON object. No markdown, no backticks.", { temperature: 0.1 });
    }

    let parsedJSON = JSON.parse(responseText.trim());
    parsedJSON.id = 'rep_' + Date.now();
    parsedJSON.fileName = fileName || 'Medical_Report.pdf';
    parsedJSON.uploadDate = new Date().toISOString().split('T')[0];

    const db = await readDb(req.userId);
    db.medical_reports.unshift(parsedJSON);
    
    db.timeline.unshift({
      time: getFormattedTime(),
      text: `Uploaded and parsed medical report: ${parsedJSON.fileName}`,
      type: 'medical'
    });
    await writeDb(req.userId, db);

    return res.json(parsedJSON);

  } catch (error) {
    console.error('Medical report upload error:', error);
    return res.status(500).json({ error: 'Failed to analyze report.', details: error.message });
  }
});

// Route: Get AI coaching insights
app.get('/health/insights', async (req, res) => {
  const db = await readDb(req.userId);
  
  if (!anthropic && !googleGenAI) {
    return res.json(db.insights);
  }

  const promptText = `
Analyze the user's weekly health metrics:
Sleep: ${JSON.stringify(db.sleep_logs.slice(-7))}
Steps: ${JSON.stringify(db.step_logs.slice(-7))}
Water: ${JSON.stringify(db.water_logs.slice(-7))}
Workouts: ${JSON.stringify(db.workout_logs.slice(-7))}

Provide 3 highly personalized, conversational coaching observations connecting different biometric areas (e.g. sleep vs. activity, steps consistency, hydration impact).
Return your response STRICTLY as a JSON array of objects (no markdown wrappers, no backticks, no conversational text):
[
  { "id": "1", "text": "Observation based on trends...", "category": "sleep/activity/hydration/general" },
  { "id": "2", "text": "Observation...", "category": "..." },
  { "id": "3", "text": "Observation...", "category": "..." }
]
`;

  try {
    let responseText = '';
    if (googleGenAI) {
      responseText = await orchestrateAI(promptText, "You are Orbit's physiological coaching engine. Return only a JSON array. No markdown.", { temperature: 0.2 });
    } else if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        temperature: 0.2,
        system: "You are Orbit's physiological coaching engine. Return only a JSON array.",
        messages: [{ role: 'user', content: promptText }],
      });
      responseText = message.content[0].text;
    }

    const parsed = JSON.parse(responseText.trim());
    db.insights = parsed;
    await writeDb(req.userId, db);
    res.json(parsed);
  } catch (error) {
    console.error('Failed to generate AI insights:', error);
    res.json(db.insights); // return cached
  }
});

// ─── DOCUMENT BRAIN — DIGITAL LIFE VAULT ────────────────────────────────────

// Database user resolver helper
async function getNeonUser(firebaseUid) {
  if (!firebaseUid) return null;
  const match = await db.select().from(dbSchema.users).where(eq(dbSchema.users.firebaseUid, firebaseUid));
  if (match.length > 0) return match[0];
  return null;
}

async function readDocs() {
  try {
    const activeUserId = authStorage.getStore()?.userId;
    const user = await getNeonUser(activeUserId);
    if (!user) return [];
    
    const dbDocs = await db.select().from(dbSchema.documents).where(eq(dbSchema.documents.userId, user.id));
    return dbDocs.map(d => ({
      id: d.id,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      fileType: d.fileType,
      base64: d.base64,
      extractedText: d.extractedText,
      summary: d.summary,
      category: d.category,
      metadata: d.metadata || {},
      expiryDate: d.expiryDate,
      relatedTypes: d.relatedTypes || [],
      aiInsight: d.aiInsight,
      createdAt: d.createdAt?.toISOString()
    }));
  } catch (err) {
    console.error('Error reading documents from Neon:', err);
    return [];
  }
}

async function writeDocs(docs) {
  try {
    const activeUserId = authStorage.getStore()?.userId;
    const user = await getNeonUser(activeUserId);
    if (!user) return;

    for (const doc of docs) {
      await db.insert(dbSchema.documents).values({
        id: doc.id,
        userId: user.id,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl || null,
        fileType: doc.fileType || null,
        base64: doc.base64 || null,
        extractedText: doc.extractedText || null,
        summary: doc.summary || null,
        category: doc.category || 'Personal',
        metadata: doc.metadata || {},
        issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString().split('T')[0] : null,
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : null,
        relatedTypes: doc.relatedTypes || [],
        aiInsight: doc.aiInsight || null,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: dbSchema.documents.id,
        set: {
          fileName: doc.fileName,
          fileUrl: doc.fileUrl || null,
          fileType: doc.fileType || null,
          base64: doc.base64 || null,
          extractedText: doc.extractedText || null,
          summary: doc.summary || null,
          category: doc.category || 'Personal',
          metadata: doc.metadata || {},
          expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : null,
          relatedTypes: doc.relatedTypes || [],
          aiInsight: doc.aiInsight || null,
          updatedAt: new Date()
        }
      });

      // Trigger RAG chunking and embedding ingestion asynchronously
      if (doc.extractedText && orchestrator && orchestrator.ragService) {
        orchestrator.ragService.ingestDocument(user.id, doc.id, doc.extractedText).catch(e => {
          console.error('[writeDocs RAG ingestion error]:', e);
        });
      }
    }

    const currentIds = docs.map(d => d.id);
    if (currentIds.length > 0) {
      // Clean up deleted files
      // await db.delete(dbSchema.documents).where(and(eq(dbSchema.documents.userId, user.id), notIn(dbSchema.documents.id, currentIds)));
    } else {
      await db.delete(dbSchema.documents).where(eq(dbSchema.documents.userId, user.id));
    }
  } catch (err) {
    console.error('Error writing documents to Neon:', err);
  }
}

function generateDocId() {
  return crypto.randomUUID();
}

// Determine category icon and colour hint from category string
const CATEGORY_META = {
  Identity:   { icon: '🪪', color: 'charcoal' },
  Financial:  { icon: '💰', color: 'forest' },
  Medical:    { icon: '🩺', color: 'terracotta' },
  Education:  { icon: '🎓', color: 'sage' },
  Legal:      { icon: '⚖️', color: 'charcoal' },
  Personal:   { icon: '🗂️', color: 'charcoal' },
  Travel:     { icon: '✈️', color: 'forest' },
  Home:       { icon: '🏠', color: 'charcoal' },
  Insurance:  { icon: '🛡️', color: 'forest' },
  Employment: { icon: '💼', color: 'charcoal' },
};

// Mock extraction fallback when no AI keys are configured
function mockExtractDocument(fileName, mimeType) {
  const name = fileName.toLowerCase();
  let category = 'Personal';
  let metadata = {};
  let summary = '';
  let relatedTypes = [];
  let aiInsight = '';
  let expiryDate = null;

  if (name.includes('passport')) {
    category = 'Identity';
    summary = '[DEMO] Passport document detected. Key identity fields extracted.';
    metadata = { 'Document Type': 'Passport', 'Expiry Date': '2031-03-15', 'Nationality': 'Indian' };
    expiryDate = '2031-03-15';
    relatedTypes = ['Visa', 'Travel Insurance', 'Flight Tickets'];
    aiInsight = 'Your passport appears valid. Renew 6 months before expiry for international travel.';
  } else if (name.includes('aadhaar') || name.includes('aadhar')) {
    category = 'Identity';
    summary = '[DEMO] Aadhaar card detected. UID and biometric data noted.';
    metadata = { 'Document Type': 'Aadhaar', 'UID': 'XXXX-XXXX-XXXX' };
    relatedTypes = ['PAN Card', 'Voter ID'];
    aiInsight = 'Aadhaar is a lifetime identity document with no expiry.';
  } else if (name.includes('pan')) {
    category = 'Identity';
    summary = '[DEMO] PAN card detected. Tax identification number extracted.';
    metadata = { 'Document Type': 'PAN Card', 'PAN Number': 'ABCDE1234F' };
    relatedTypes = ['Tax Returns', 'Bank Statements'];
    aiInsight = 'PAN card is a permanent document. Link it to Aadhaar for compliance.';
  } else if (name.includes('bank') || name.includes('statement')) {
    category = 'Financial';
    summary = '[DEMO] Bank statement detected. Transaction summary extracted.';
    metadata = { 'Bank': 'State Bank of India', 'Period': 'June 2026', 'Closing Balance': '₹42,300' };
    relatedTypes = ['Salary Slips', 'Tax Returns'];
    aiInsight = 'Your closing balance this month was ₹42,300. Spending was within normal range.';
  } else if (name.includes('salary') || name.includes('payslip')) {
    category = 'Financial';
    summary = '[DEMO] Salary slip detected. Compensation details extracted.';
    metadata = { 'Month': 'June 2026', 'Gross Salary': '₹85,000', 'Net Salary': '₹72,400', 'PF Deduction': '₹10,200' };
    relatedTypes = ['Bank Statements', 'Tax Returns', 'Rental Agreement'];
    aiInsight = 'Net take-home this month: ₹72,400. PF contribution recorded.';
  } else if (name.includes('tax') || name.includes('itr')) {
    category = 'Financial';
    summary = '[DEMO] Tax document detected. Filing details extracted.';
    metadata = { 'Assessment Year': '2025-26', 'Filed On': '2025-07-20', 'Refund': '₹8,400' };
    relatedTypes = ['Salary Slips', 'Bank Statements'];
    expiryDate = '2027-03-31';
    aiInsight = 'Your ITR for AY 2025-26 was filed on time. Refund of ₹8,400 was processed.';
  } else if (name.includes('blood') || name.includes('report') || name.includes('lab')) {
    category = 'Medical';
    summary = '[DEMO] Medical report detected. Lab values and test results extracted.';
    metadata = { 'Hospital': 'Apollo Diagnostics', 'Test Date': '2026-06-10', 'Report Type': 'Blood Panel' };
    relatedTypes = ['Prescriptions', 'Insurance', 'Previous Reports'];
    aiInsight = 'Haemoglobin and cholesterol values are within normal range. Schedule a follow-up in 6 months.';
  } else if (name.includes('prescription') || name.includes('rx')) {
    category = 'Medical';
    summary = '[DEMO] Prescription detected. Medications and dosage extracted.';
    metadata = { 'Doctor': 'Dr. Mehta', 'Date': '2026-06-12', 'Validity': '30 days' };
    relatedTypes = ['Medical Reports', 'Insurance Claims'];
    expiryDate = '2026-07-12';
    aiInsight = 'This prescription expires in 30 days. Refill before the due date.';
  } else if (name.includes('insurance')) {
    category = 'Insurance';
    summary = '[DEMO] Insurance policy detected. Coverage and premium details extracted.';
    metadata = { 'Provider': 'HDFC ERGO', 'Sum Insured': '₹10,00,000', 'Premium': '₹18,500/yr', 'Renewal Date': '2027-04-01' };
    expiryDate = '2027-04-01';
    relatedTypes = ['Medical Reports', 'Hospital Bills'];
    aiInsight = 'Policy renews in April 2027. Set a reminder 30 days before to avoid lapse.';
  } else if (name.includes('rental') || name.includes('rent') || name.includes('lease')) {
    category = 'Legal';
    summary = '[DEMO] Rental agreement detected. Key terms and dates extracted.';
    metadata = { 'Monthly Rent': '₹18,000', 'Deposit': '₹36,000', 'Duration': '11 Months', 'Notice Period': '30 Days', 'Expiry Date': '2027-02-12' };
    expiryDate = '2027-02-12';
    relatedTypes = ['Electricity Bills', 'Maintenance Receipts', 'Landlord NOC'];
    aiInsight = 'Agreement expires Feb 2027. Late payment penalty applies. Maintenance costs not included.';
  } else if (name.includes('degree') || name.includes('certificate') || name.includes('diploma')) {
    category = 'Education';
    summary = '[DEMO] Educational certificate detected. Academic credentials extracted.';
    metadata = { 'Institution': 'University of Mumbai', 'Degree': 'B.Tech Computer Science', 'Year': '2022', 'CGPA': '8.4' };
    relatedTypes = ['Mark Sheets', 'Resume', 'Internship Letters'];
    aiInsight = 'Graduation certificate verified. Store a certified copy for job applications.';
  } else if (name.includes('invoice') || name.includes('bill') || name.includes('receipt')) {
    category = 'Personal';
    summary = '[DEMO] Invoice or receipt detected. Purchase details extracted.';
    metadata = { 'Vendor': 'Amazon', 'Amount': '₹4,299', 'Date': '2026-06-28', 'GST': '18%' };
    relatedTypes = ['Warranty Cards', 'Bank Statements'];
    aiInsight = 'Keep this receipt for warranty claims and expense tracking.';
  } else {
    category = 'Personal';
    summary = `[DEMO] Document "${fileName}" uploaded. AI analysis would extract key details in production.`;
    metadata = { 'File Type': mimeType, 'Status': 'Processed' };
    relatedTypes = ['Related Documents'];
    aiInsight = 'Upload complete. Configure an AI API key for intelligent extraction.';
  }

  return { category, summary, metadata, expiryDate, relatedTypes, aiInsight };
}

// POST /documents/upload — analyze & store a document
app.post('/documents/upload', async (req, res) => {
  const { fileName, mimeType, base64, fileSize } = req.body;

  if (!fileName || !mimeType || !base64) {
    return res.status(400).json({ error: 'fileName, mimeType, and base64 are required.' });
  }

  const byteSize = Math.ceil(base64.length * 0.75);
  if (byteSize > MAX_DOC_BYTES) {
    return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
  }

  const docs = await readDocs();
  if (docs.length >= MAX_VAULT_DOCS) {
    return res.status(429).json({ error: 'Vault limit reached (100 documents). Delete some documents to continue.' });
  }

  let extracted;

  if (!anthropic && !googleGenAI) {
    console.warn('[Document Brain] No AI keys. Using mock extraction.');
    extracted = mockExtractDocument(fileName, mimeType);
  } else {
    const extractionPrompt = `
You are Orbit's Document Intelligence Core analyzing an uploaded file.
File name: ${fileName}
MIME type: ${mimeType}

Analyze this document and return ONLY a JSON object with this exact structure:
{
  "category": "one of: Identity, Financial, Medical, Education, Legal, Personal, Travel, Home, Insurance, Employment",
  "summary": "2-4 bullet points as a single string describing what this document is and its key facts",
  "metadata": { "Field Label": "Value", ... },
  "expiryDate": "YYYY-MM-DD or null if no expiry",
  "relatedTypes": ["Related Document Type 1", "Related Document Type 2"],
  "aiInsight": "One actionable sentence about this document"
}

For metadata, extract only the most important 3-6 fields relevant to this document type.
Do not include any text outside the JSON object.
`;

    try {
      let responseText = '';

      if (googleGenAI) {
        const parts = [
          { text: extractionPrompt },
          { inlineData: { data: base64, mimeType } }
        ];
        responseText = await orchestrateAI(parts, "You are Orbit's Document Intelligence Core. Return only a JSON object. No markdown.", { temperature: 0.1 });
      } else if (anthropic) {
        const isImage = mimeType.startsWith('image/');
        const contentParts = [{ type: 'text', text: extractionPrompt }];
        if (isImage) {
          contentParts.unshift({
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 }
          });
        }
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          temperature: 0.1,
          system: 'Return only a JSON object. No markdown. No backticks.',
          messages: [{ role: 'user', content: contentParts }],
        });
        responseText = message.content[0].text;
      }

      let clean = responseText.trim();
      if (clean.startsWith('```json')) clean = clean.substring(7);
      else if (clean.startsWith('```')) clean = clean.substring(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      extracted = JSON.parse(clean.trim());
    } catch (aiErr) {
      console.error('[Document Brain] AI extraction failed, using mock fallback:', aiErr.message);
      extracted = mockExtractDocument(fileName, mimeType);
    }
  }

  const catMeta = CATEGORY_META[extracted.category] || { icon: '📄', color: 'charcoal' };
  const extractedText = `${extracted.summary || ''}\n\nMetadata:\n${JSON.stringify(extracted.metadata || {}, null, 2)}\n\nInsight: ${extracted.aiInsight || ''}`;
  const doc = {
    id: generateDocId(),
    fileName,
    mimeType,
    fileSize: fileSize || byteSize,
    uploadedAt: new Date().toISOString(),
    category: extracted.category || 'Personal',
    categoryIcon: catMeta.icon,
    categoryColor: catMeta.color,
    summary: extracted.summary || '',
    metadata: extracted.metadata || {},
    expiryDate: extracted.expiryDate || null,
    relatedTypes: extracted.relatedTypes || [],
    aiInsight: extracted.aiInsight || '',
    base64, // stored for AI Q&A chat
    extractedText
  };

  docs.unshift(doc); // newest first
  await writeDocs(docs);

  // Return doc without base64 to keep response light
  const { base64: _b64, ...docPublic } = doc;
  res.status(201).json(docPublic);
});

// GET /documents — list all stored documents (without base64)
app.get('/documents', async (req, res) => {
  const docs = await readDocs();
  const public_docs = docs.map(({ base64: _b, ...rest }) => rest);
  res.json({ documents: public_docs, total: public_docs.length });
});

// GET /documents/expiring — docs with expiryDate within 180 days
app.get('/documents/expiring', async (req, res) => {
  const docs = await readDocs();
  const now = new Date();
  const cutoff = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const expiring = docs
    .filter(d => {
      if (!d.expiryDate) return false;
      const exp = new Date(d.expiryDate);
      return exp > now && exp <= cutoff;
    })
    .map(({ base64: _b, ...rest }) => rest)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  res.json({ documents: expiring });
});

// POST /documents/search — natural language search across vault
app.post('/documents/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required.' });

  const docs = await readDocs();
  if (docs.length === 0) return res.json({ results: [] });

  // Always do local keyword match as baseline
  const q = query.toLowerCase();
  const localMatches = docs.filter(d =>
    d.fileName.toLowerCase().includes(q) ||
    d.category.toLowerCase().includes(q) ||
    (d.summary || '').toLowerCase().includes(q) ||
    Object.values(d.metadata || {}).some(v => String(v).toLowerCase().includes(q)) ||
    (d.aiInsight || '').toLowerCase().includes(q) ||
    (d.relatedTypes || []).some(r => r.toLowerCase().includes(q))
  );

  if (!anthropic && !googleGenAI) {
    return res.json({ results: localMatches.map(({ base64: _b, ...r }) => r) });
  }

  // AI-assisted ranking
  const summaryContext = docs.map(d =>
    `ID:${d.id} | ${d.category} | ${d.fileName} | ${d.summary} | ${JSON.stringify(d.metadata)}`
  ).join('\n');

  const prompt = `
User query: "${query}"

Documents in vault:
${summaryContext}

Return a JSON array of document IDs that best match the query, ordered by relevance. Example: ["id1", "id2"]
Return only the JSON array, no other text.
`;

  try {
    let responseText = '';
    if (googleGenAI) {
      responseText = await orchestrateAI(prompt, '', { temperature: 0.1 });
    } else if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', max_tokens: 512, temperature: 0.1,
        system: 'Return only a JSON array of IDs.',
        messages: [{ role: 'user', content: prompt }],
      });
      responseText = message.content[0].text;
    }
    let clean = responseText.trim();
    if (clean.startsWith('```')) clean = clean.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
    const ids = JSON.parse(clean);
    const idSet = new Set(ids);
    const aiResults = ids
      .map(id => docs.find(d => d.id === id))
      .filter(Boolean)
      .map(({ base64: _b, ...r }) => r);
    // Append local matches not already included
    localMatches.forEach(d => {
      if (!idSet.has(d.id)) {
        const { base64: _b, ...r } = d;
        aiResults.push(r);
      }
    });
    return res.json({ results: aiResults });
  } catch {
    return res.json({ results: localMatches.map(({ base64: _b, ...r }) => r) });
  }
});

// POST /documents/chat — ask a question about a specific document
app.post('/documents/chat', async (req, res) => {
  const { documentId, question } = req.body;
  if (!documentId || !question) return res.status(400).json({ error: 'documentId and question are required.' });

  const docs = await readDocs();
  const doc = docs.find(d => d.id === documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  if (!anthropic && !googleGenAI) {
    return res.json({
      answer: `[DEMO] Based on the stored information about "${doc.fileName}": ${doc.aiInsight || doc.summary}. Configure an AI API key for full document Q&A.`
    });
  }

  const contextStr = `Document: ${doc.fileName}\nCategory: ${doc.category}\nSummary: ${doc.summary}\nMetadata: ${JSON.stringify(doc.metadata, null, 2)}\nExpiry: ${doc.expiryDate || 'N/A'}\nAI Insight: ${doc.aiInsight}`;
  const prompt = `${contextStr}\n\nUser question: ${question}\n\nAnswer in 1-3 sentences based on the document information above. Be specific and cite extracted values.`;

  try {
    let answer = '';
    if (googleGenAI) {
      const parts = [{ text: prompt }];
      if (doc.base64 && doc.mimeType) {
        parts.push({ inlineData: { data: doc.base64, mimeType: doc.mimeType } });
      }
      answer = await orchestrateAI(parts, '', { temperature: 0.3 });
    } else if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', max_tokens: 512, temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });
      answer = message.content[0].text;
    }
    res.json({ answer: answer.trim() });
  } catch (err) {
    res.json({ answer: `Based on stored information: ${doc.aiInsight || doc.summary}` });
  }
});

// DELETE /documents/:id — remove a document from vault
app.delete('/documents/:id', async (req, res) => {
  const { id } = req.params;
  const docs = await readDocs();
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Document not found.' });
  docs.splice(idx, 1);
  await writeDocs(docs);
  res.json({ success: true });
});

// ─── AI DECISION ENGINE ───────────────────────────────────────────────────────

const MAX_DECISION_HISTORY = 50;

async function readDecisions(userId) {
  if (!userId) return [];
  try {
    const dbDecisions = await db.select().from(dbSchema.decisions)
      .where(eq(dbSchema.decisions.userId, userId))
      .orderBy(desc(dbSchema.decisions.createdAt));
      
    return dbDecisions.map(d => {
      let parsedOptions = {};
      try {
        parsedOptions = typeof d.options === 'string' ? JSON.parse(d.options) : (d.options || {});
      } catch {
        parsedOptions = d.options || {};
      }
      
      let parsedReasoning = [];
      try {
        parsedReasoning = typeof d.reasoning === 'string' ? JSON.parse(d.reasoning) : (d.reasoning || []);
      } catch {
        parsedReasoning = d.reasoning ? [d.reasoning] : [];
      }

      return {
        id: d.id,
        question: d.question,
        domain: parsedOptions.domain || 'general',
        recommendation: d.recommendation,
        confidence: parsedOptions.confidence || 80,
        timestamp: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
        outcome: parsedOptions.outcome || null,
        feedback: parsedOptions.feedback || null,
        reasoning: parsedReasoning,
        tradeoffs: parsedOptions.tradeoffs || [],
        risks: parsedOptions.risks || [],
        missing_information: parsedOptions.missing_information || [],
        next_step: parsedOptions.next_step || '',
        scenarioA: parsedOptions.scenarioA || null,
        scenarioB: parsedOptions.scenarioB || null,
        nextActions: parsedOptions.nextActions || [],
        dataUsed: parsedOptions.dataUsed || []
      };
    });
  } catch (err) {
    console.error('Error reading decisions from Neon:', err);
    return [];
  }
}

async function writeDecisions(userId, decisions) {
  if (!userId) return;
  try {

    for (let i = 0; i < decisions.length; i++) {
      const d = decisions[i];
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(d.id);
      
      const optionsVal = {
        domain: d.domain,
        confidence: d.confidence,
        scenarioA: d.scenarioA,
        scenarioB: d.scenarioB,
        nextActions: d.nextActions,
        dataUsed: d.dataUsed,
        outcome: d.outcome || null,
        feedback: d.feedback || null
      };

      const res = await db.insert(dbSchema.decisions).values({
        id: isUuid ? d.id : undefined,
        userId: userId,
        question: d.question,
        recommendation: d.recommendation,
        reasoning: Array.isArray(d.reasoning) ? JSON.stringify(d.reasoning) : (d.reasoning || null),
        options: optionsVal,
        createdAt: d.timestamp ? new Date(d.timestamp) : new Date()
      }).onConflictDoUpdate({
        target: dbSchema.decisions.id,
        set: {
          question: d.question,
          recommendation: d.recommendation,
          reasoning: Array.isArray(d.reasoning) ? JSON.stringify(d.reasoning) : (d.reasoning || null),
          options: optionsVal
        }
      }).returning();

      if (res && res[0]) {
        decisions[i].id = res[0].id;
      }
    }

    const currentIds = decisions.map(d => d.id).filter(id => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id));
    if (currentIds.length > 0) {
      await db.delete(dbSchema.decisions).where(
        and(
          eq(dbSchema.decisions.userId, user.id),
          not(inArray(dbSchema.decisions.id, currentIds))
        )
      );
    }
  } catch (err) {
    console.error('Error writing decisions to Neon:', err);
  }
}

function generateDecisionId() {
  return crypto.randomUUID();
}

// Detect intent domain from question text
function detectIntent(question) {
  const q = question.toLowerCase();
  if (/afford|buy|purchase|spend|budget|loan|invest|emi|salary|income|saving|bill|expense|cost|price|travel|vacation|trip|₹|\$/.test(q)) return 'financial';
  if (/workout|gym|exercise|sleep|tired|rest|walk|run|steps|heart|calories|hydrat|water|diet|eat|weight|health|sick|recover|fit/.test(q)) return 'health';
  if (/job|career|resign|quit|hire|salary|offer|switch|startup|company|interview|promotion/.test(q)) return 'career';
  if (/study|exam|course|learn|certification|syllabus|skill|degree|college/.test(q)) return 'education';
  if (/contract|insurance|legal|sign|rental|agreement|policy|renew|document|passport/.test(q)) return 'legal';
  if (/travel|vacation|leave|holiday|trip|flight|book/.test(q)) return 'lifestyle';
  return 'general';
}

// Build context payload from real DB data based on intent
function buildContext(db, intent, calendarEvents, expiringDocs) {
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySteps = db.step_logs?.find(l => l.date === todayStr) || { count: 8432 };
  const todaySleep = db.sleep_logs?.find(l => l.date === todayStr) || { duration: 402 };
  const yesterdaySleep = db.sleep_logs?.[db.sleep_logs.length - 2] || { duration: 390 };
  const todayHR = db.heart_rate_logs?.find(l => l.date === todayStr) || { bpm: 72 };
  const todayWorkouts = db.workout_logs?.filter(l => l.date === todayStr) || [];
  const recentWorkouts = db.workout_logs?.slice(-5) || [];
  const finance = db.finance || { monthlyBudget: 28400, spent: 18700, remaining: 9700, billsDue: 2, recurringBills: [] };
  const learning = db.learning || { todayPlan: [], revisionReminders: [] };
  const pendingLearning = learning.todayPlan.filter(p => p.status !== 'completed');
  const goals = db.goals || [];
  const avgSleepMins = db.sleep_logs?.slice(-7).reduce((s, l) => s + l.duration, 0) / Math.min(db.sleep_logs?.length || 1, 7) || 400;

  const healthCtx = {
    sleepLastNight: `${Math.floor(todaySleep.duration / 60)}h ${todaySleep.duration % 60}m`,
    sleepGoal: '7h 30m',
    avgSleep7Days: `${Math.floor(avgSleepMins / 60)}h ${Math.round(avgSleepMins % 60)}m`,
    stepsToday: todaySteps.count,
    stepsGoal: 10000,
    heartRate: todayHR.bpm,
    workoutToday: todayWorkouts.length > 0 ? todayWorkouts[0].type : 'None',
    recentWorkouts: recentWorkouts.map(w => `${w.date}: ${w.type} (${w.duration}min)`),
    waterMl: db.water_logs?.find(l => l.date === todayStr)?.amount || 2300,
    waterGoalMl: 3000,
  };

  const financeCtx = {
    monthlyBudget: finance.monthlyBudget,
    spent: finance.spent,
    remaining: finance.remaining,
    savingsRate: `${Math.round((finance.remaining / finance.monthlyBudget) * 100)}%`,
    billsDue: finance.billsDue,
    upcomingBills: (finance.recurringBills || []).filter(b => b.status === 'unpaid').map(b => `${b.name}: ₹${b.amount}`),
    recentExpenses: (finance.recentExpenses || []).slice(0, 5).map(e => `${e.description}: ₹${e.amount}`),
  };

  const calCtx = {
    eventsToday: calendarEvents.length,
    events: calendarEvents.slice(0, 5).map(e => e.isAllDay ? `All day: ${e.title}` : `${e.start}: ${e.title}`),
  };

  const docCtx = {
    expiringDocuments: expiringDocs.slice(0, 5).map(d => `${d.fileName} (${d.expiryDate})`),
  };

  const learningCtx = {
    pendingToday: pendingLearning.map(p => p.subject),
    revisionReminders: learning.revisionReminders.map(r => r.subject),
  };

  const goalsCtx = goals.map(g => ({
    title: g.title,
    progress: `${g.currentValue}/${g.targetValue} ${g.unit}`,
  }));

  // Select which contexts to include based on intent
  const ctx = { intent, calendar: calCtx, expiringDocs: docCtx };
  if (['financial', 'lifestyle', 'legal', 'general'].includes(intent)) ctx.finance = financeCtx;
  if (['health', 'lifestyle', 'general'].includes(intent)) ctx.health = healthCtx;
  if (['career', 'education', 'general'].includes(intent)) ctx.learning = learningCtx;
  if (['career', 'general', 'financial'].includes(intent)) ctx.goals = goalsCtx;
  // Always include health for lifestyle
  if (intent === 'lifestyle') { ctx.health = healthCtx; ctx.finance = financeCtx; }
  return ctx;
}

// Rich local fallback mock engine using real DB values
function buildMockDecision(question, intent, ctx) {
  const q = question.toLowerCase();
  const finance = ctx.finance || {};
  const health = ctx.health || {};

  // ── Finance decisions
  if (intent === 'financial' && /afford|buy|purchase/.test(q)) {
    const rem = finance.remaining || 9700;
    const budget = finance.monthlyBudget || 28400;
    const spentPct = Math.round(((budget - rem) / budget) * 100);
    const canAfford = rem > 15000;
    return {
      recommendation: canAfford
        ? 'You can make this purchase, but review your emergency fund first.'
        : 'Wait until next month. Your current finances are stretched.',
      confidence: canAfford ? 72 : 85,
      domain: 'financial',
      reasoning: [
        `Your remaining budget this month is ₹${rem.toLocaleString('en-IN')} (${100 - spentPct}% of ₹${budget.toLocaleString('en-IN')}).`,
        finance.billsDue > 0 ? `You have ${finance.billsDue} upcoming bill(s) that will reduce your disposable cash.` : 'No urgent bills due.',
        canAfford ? 'Your savings rate this month is healthy enough to absorb a planned purchase.' : 'Spending more now would push your monthly burn above 80%.',
        'Maintain at least ₹10,000 as an emergency buffer at all times.',
      ],
      scenarioA: {
        label: 'Purchase Now',
        outcome: canAfford ? `Remaining budget drops to ≈₹${Math.max(0, rem - 8000).toLocaleString('en-IN')}. Manageable if no unexpected expenses.` : `Remaining drops to ≈₹${Math.max(0, rem - 8000).toLocaleString('en-IN')}, dangerously close to zero.`,
        impact: [canAfford ? '✓ Immediate access to item' : '✗ Emergency fund depleted', `${canAfford ? '~' : '✗'} ₹${Math.max(0, rem - 8000).toLocaleString('en-IN')} left for month`, '✗ No buffer for surprises'],
      },
      scenarioB: {
        label: 'Wait 1–2 Months',
        outcome: 'Budget resets. You save an additional ₹8,000–12,000, making the purchase risk-free.',
        impact: ['✓ Full emergency fund intact', '✓ No financial stress', '✓ Possibly catch a sale price'],
      },
      nextActions: ['Check Budget', 'Review Bills', 'Set Savings Goal'],
      dataUsed: ['finance', 'calendar'],
    };
  }

  // ── Health: workout decision
  if (intent === 'health' && /workout|gym|exercise|skip/.test(q)) {
    const sleepMins = parseInt(health.sleepLastNight) * 60 || 402;
    const sleepHrs = parseFloat(health.sleepLastNight) || 6.7;
    const goodSleep = sleepHrs >= 7;
    const hasWorkoutToday = health.workoutToday !== 'None';
    return {
      recommendation: hasWorkoutToday
        ? 'You already worked out today. Rest or do light stretching tonight.'
        : goodSleep
          ? 'Yes, a moderate workout today will boost your energy and mood.'
          : 'Do a light 20–30 minute walk instead of intense training.',
      confidence: 83,
      domain: 'health',
      reasoning: [
        `You slept ${health.sleepLastNight} last night (goal: ${health.sleepGoal}).`,
        goodSleep ? 'Your sleep was sufficient for recovery — body is ready for exercise.' : 'Insufficient sleep impairs muscle recovery and increases injury risk.',
        `Today\'s step count: ${(health.stepsToday || 0).toLocaleString()} / 10,000 goal.`,
        hasWorkoutToday ? `Already completed: ${health.workoutToday}.` : 'No workout logged yet today.',
      ],
      scenarioA: {
        label: goodSleep ? 'Full Workout' : 'Intense Workout',
        outcome: goodSleep ? 'Energy boost, progress toward weekly exercise goal (150 min).' : 'High fatigue risk. May impair tomorrow\'s performance.',
        impact: goodSleep
          ? ['✓ Burns 350–500 calories', '✓ Improves mood', '✓ Weekly goal progress']
          : ['✗ Injury risk elevated', '✗ Recovery time increases', '✗ Sleep quality may worsen'],
      },
      scenarioB: {
        label: goodSleep ? 'Rest Day' : 'Light Walk (20 min)',
        outcome: goodSleep ? 'Full recovery. Resume tomorrow at full intensity.' : 'Gentle movement boosts circulation without depleting recovery reserves.',
        impact: ['✓ Muscle recovery', '✓ Reduced cortisol', goodSleep ? '~ Slight goal delay' : '✓ Maintains step count progress'],
      },
      nextActions: ['Log Workout', 'Check Steps', 'View Health'],
      dataUsed: ['health', 'calendar'],
    };
  }

  // ── Health: sleep decision
  if (intent === 'health' && /sleep|rest|tired|fatigue/.test(q)) {
    const sleepHrs = parseFloat(health.sleepLastNight) || 6.7;
    const avgHrs = parseFloat(health.avgSleep7Days) || 6.5;
    return {
      recommendation: sleepHrs < 7 ? 'Yes, prioritize sleep tonight. You have a deficit to recover.' : 'Your sleep is on track. Maintain your current bedtime.',
      confidence: 88,
      domain: 'health',
      reasoning: [
        `Last night: ${health.sleepLastNight} (goal: ${health.sleepGoal}).`,
        `7-day average: ${health.avgSleep7Days} — ${avgHrs < 7 ? 'below recommended minimum' : 'within healthy range'}.`,
        'Adults need 7–9 hours for optimal cognitive and physical recovery.',
        'Consistent sleep deprivation increases cortisol and reduces decision quality.',
      ],
      scenarioA: {
        label: 'Sleep by 10pm Tonight',
        outcome: `8+ hours possible. Wakes up rested. Cognitive performance peaks.`,
        impact: ['✓ Full recovery cycle', '✓ Improved focus tomorrow', '✓ Reduces health risk'],
      },
      scenarioB: {
        label: 'Stay Up Late',
        outcome: 'Compounds sleep debt. Productivity decreases by ~30% next day.',
        impact: ['✗ Deeper sleep deficit', '✗ Higher stress hormones', '✗ Impaired memory consolidation'],
      },
      nextActions: ['View Health', 'Log Sleep', 'Set Reminder'],
      dataUsed: ['health'],
    };
  }

  // ── Career / Job decision
  if (intent === 'career') {
    return {
      recommendation: 'Gather more data before deciding. Run a structured comparison across compensation, growth, and lifestyle factors.',
      confidence: 68,
      domain: 'career',
      reasoning: [
        'Career decisions benefit from structured frameworks, not just gut feeling.',
        'Consider: Total compensation (salary + equity + benefits), growth trajectory, culture fit, and role scope.',
        ctx.learning?.pendingToday?.length > 0 ? `You have ${ctx.learning.pendingToday.length} pending learning tasks — career upskilling is active.` : 'Your current learning momentum is worth protecting.',
        'Give yourself 48 hours to reflect after gathering all facts.',
      ],
      scenarioA: {
        label: 'Accept / Take Action',
        outcome: 'New opportunity. Higher risk, potentially higher reward. Transition period of 1–3 months.',
        impact: ['~ Short-term adjustment period', '✓ New growth potential', '✗ Known stability lost'],
      },
      scenarioB: {
        label: 'Decline / Stay',
        outcome: 'Stability maintained. Focus on accelerating growth in current role.',
        impact: ['✓ Known environment', '✓ No transition stress', '~ Growth may be slower'],
      },
      nextActions: ['View Goals', 'View Learning', 'Review Documents'],
      dataUsed: ['career', 'learning', 'calendar'],
    };
  }

  // ── Lifestyle / Travel decision
  if (intent === 'lifestyle' || /travel|vacation|trip/.test(q)) {
    const rem = ctx.finance?.remaining || 9700;
    const canAfford = rem > 20000;
    const hasPassport = (ctx.expiringDocs?.expiringDocuments || []).some(d => /passport/i.test(d));
    return {
      recommendation: canAfford
        ? 'A short trip is financially feasible. Plan it for a low-calendar-density week.'
        : 'Wait until your budget recovers. A trip now would strain your monthly finances.',
      confidence: 74,
      domain: 'lifestyle',
      reasoning: [
        `Current budget remaining: ₹${rem.toLocaleString('en-IN')}.`,
        canAfford ? 'You have enough discretionary buffer for a budget trip.' : 'Monthly spending is already at 65%+ — a trip would push it over.',
        `Today's calendar has ${ctx.calendar?.eventsToday || 0} events — check upcoming weeks for a low-density window.`,
        hasPassport ? '⚠️ Your passport is expiring soon — verify validity for international travel.' : 'No critical document expiry detected.',
        `Sleep average: ${health.avgSleep7Days || '6h 30m'} — rest before any travel.`,
      ],
      scenarioA: {
        label: 'Travel Next Month',
        outcome: canAfford ? 'Budget trip feasible. Estimate ₹15,000–25,000 for a domestic trip.' : 'Would require ₹20,000+, putting finances in the red.',
        impact: [canAfford ? '✓ Within budget' : '✗ Exceeds budget', '✓ Mental health benefit', '~ Plan leave in low-work week'],
      },
      scenarioB: {
        label: 'Wait 2–3 Months',
        outcome: 'Larger savings buffer. Better financial cushion. More planning time.',
        impact: ['✓ Larger budget', '✓ Time to book deals', '✓ Documents renewed if needed'],
      },
      nextActions: ['Check Budget', 'View Calendar', 'View Documents'],
      dataUsed: ['finance', 'health', 'calendar', 'documents'],
    };
  }

  // ── Generic fallback
  return {
    recommendation: 'Based on your current Orbit data, this requires a balanced approach weighing multiple factors.',
    confidence: 60,
    domain: intent,
    reasoning: [
      'This decision spans multiple life domains — use Orbit\'s structured data to guide your thinking.',
      `Current health: ${health.sleepLastNight || '6h 42m'} sleep, ${(health.stepsToday || 8432).toLocaleString()} steps today.`,
      `Current finances: ₹${(finance.remaining || 9700).toLocaleString('en-IN')} remaining this month.`,
      `Calendar load: ${ctx.calendar?.eventsToday || 0} events today.`,
      'Take 24 hours, list your priorities, and revisit.',
    ],
    scenarioA: {
      label: 'Act Now',
      outcome: 'Immediate action. Higher risk, faster results. Requires full commitment.',
      impact: ['~ Faster outcome', '✗ Less planning time', '✓ Momentum gained'],
    },
    scenarioB: {
      label: 'Wait & Plan',
      outcome: 'More data, better decision. Slight delay but higher confidence.',
      impact: ['✓ Better information', '✓ Lower risk', '~ Opportunity may pass'],
    },
    nextActions: ['View Dashboard', 'Check Health', 'View Calendar'],
    dataUsed: [intent, 'health', 'finance'],
  };
}

// POST /decision/analyze — multi-domain reasoning
app.post('/decision/analyze', async (req, res) => {
  const { question, additionalContext } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'question is required.' });

  const db = await readDb(req.userId);
  const intent = detectIntent(question);

  // Fetch calendar events (non-blocking)
  let calendarEvents = [];
  const client = await getOAuth2ClientForUser(req.userId);
  if (client) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: client });
      const now = new Date();
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const calRes = await calendar.events.list({
        calendarId: 'primary', timeMin: now.toISOString(), timeMax: end.toISOString(),
        singleEvents: true, orderBy: 'startTime', maxResults: 10,
      });
      calendarEvents = (calRes.data.items || []).map(e => ({
        title: e.summary, start: e.start?.dateTime || e.start?.date, isAllDay: !e.start?.dateTime,
      }));
    } catch { /* calendar unavailable */ }
  }

  // Fetch expiring documents
  let expiringDocs = [];
  try {
    const allDocs = await readDocs();
    const now = new Date();
    const cutoff = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    expiringDocs = allDocs.filter(d => {
      if (!d.expiryDate) return false;
      const exp = new Date(d.expiryDate);
      return exp > now && exp <= cutoff;
    });
  } catch { /* docs unavailable */ }

  const ctx = buildContext(db, intent, calendarEvents, expiringDocs);
  let result;

  if (!anthropic && !googleGenAI) {
    console.warn('[Decision Engine] No AI keys. Using mock reasoning engine.');
    result = buildMockDecision(question, intent, ctx);
  } else {
    const systemPrompt = `You are Orbit's AI Decision Engine — a multi-domain personal advisor.
The user asked: "${question}"
${additionalContext ? `Additional context from user: "${additionalContext}"` : ''}

Use ALL of the provided context data to give a personalized, data-driven recommendation.
Reference specific numbers (e.g. "Your remaining budget is ₹9,700", "You slept 6h 42m last night").
Never give generic advice — always tie it to the user's actual data.

Return ONLY a JSON object with this exact structure:
{
  "recommendation": "Clear, direct 1-2 sentence recommendation",
  "confidence": <integer 0-100>,
  "domain": "${intent}",
  "reasoning": ["bullet 1 with specific data reference", "bullet 2", "bullet 3", "bullet 4"],
  "scenarioA": {
    "label": "Option A label (e.g. 'Buy Now')",
    "outcome": "What happens in this scenario",
    "impact": ["impact point 1", "impact point 2", "impact point 3"]
  },
  "scenarioB": {
    "label": "Option B label (e.g. 'Wait 2 Months')",
    "outcome": "What happens in this scenario",
    "impact": ["impact point 1", "impact point 2", "impact point 3"]
  },
  "nextActions": ["Action 1", "Action 2", "Action 3"],
  "dataUsed": ["finance", "health", "calendar"]
}`;

    const promptText = `Context Data:\n${JSON.stringify(ctx, null, 2)}\n\n${systemPrompt}\n\nIMPORTANT: Return ONLY raw JSON. No markdown.`;

    try {
      let responseText = '';
      if (anthropic) {
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022', max_tokens: 1200, temperature: 0.2,
          system: 'Return only a JSON object. No markdown. No backticks.',
          messages: [{ role: 'user', content: promptText }],
        });
        responseText = message.content[0].text;
      } else if (googleGenAI) {
        responseText = await orchestrateAI(promptText, "You are Orbit's Decision Core. Return only a JSON object. No markdown.", { temperature: 0.2 });
      }

      let clean = responseText.trim();
      if (clean.startsWith('```json')) clean = clean.substring(7);
      else if (clean.startsWith('```')) clean = clean.substring(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      result = JSON.parse(clean.trim());
    } catch (aiErr) {
      console.error('[Decision Engine] AI failed, using mock fallback:', aiErr.message);
      result = buildMockDecision(question, intent, ctx);
    }
  }

  // Persist to history
  const decisionRecord = {
    id: generateDecisionId(),
    question,
    domain: result.domain || intent,
    recommendation: result.recommendation,
    confidence: result.confidence,
    timestamp: new Date().toISOString(),
  };
  try {
    const decisions = await readDecisions();
    decisions.unshift(decisionRecord);
    if (decisions.length > MAX_DECISION_HISTORY) decisions.length = MAX_DECISION_HISTORY;
    await writeDecisions(decisions);
  } catch { /* non-fatal */ }

  res.json({ ...result, decisionId: decisionRecord.id });
});

// GET /decision/history — past decisions for authenticated user
app.get('/decision/history', async (req, res) => {
  const LOG = '[GET /decision/history]';
  try {
    const user = await verifyAndGetNeonUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    let decisions = await readDecisions(user.id);

    // Support optional search filter
    const search = req.query.search;
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      decisions = decisions.filter(d => 
        (d.question && d.question.toLowerCase().includes(q)) ||
        (d.domain && d.domain.toLowerCase().includes(q)) ||
        (d.recommendation && d.recommendation.toLowerCase().includes(q))
      );
    }

    res.json({ decisions: decisions.slice(0, 50) }); // return up to 50 historical records
  } catch (err) {
    console.error(`${LOG} Error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch decision history.' });
  }
});

// POST /decision/feedback — record outcome feedback on a past decision
app.post('/decision/feedback', async (req, res) => {
  const LOG = '[POST /decision/feedback]';
  try {
    const user = await verifyAndGetNeonUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { decisionId, outcome, feedback } = req.body;
    if (!decisionId) {
      return res.status(400).json({ error: 'decisionId is required.' });
    }

    const decisions = await readDecisions(user.id);
    const idx = decisions.findIndex(d => d.id === decisionId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Decision not found or access denied.' });
    }

    decisions[idx].outcome = outcome;
    decisions[idx].feedback = feedback;
    
    await writeDecisions(user.id, decisions);
    res.json({ success: true });
  } catch (err) {
    console.error(`${LOG} Error:`, err.message);
    res.status(500).json({ error: 'Failed to update feedback.' });
  }
});

// ─── AI FINANCE BRAIN ─────────────────────────────────────────────────────────

// Helper to compute Financial Health Score and its sub-factors
function computeFinanceScore(finance) {
  const income = finance.income || 50000;
  const spent = finance.spent || 0;
  const monthlyBudget = finance.monthlyBudget || 40000;
  
  // 1. Saving Rate (25% weight)
  const savingRate = Math.max(0, (income - spent) / income);
  let savingScore = 0;
  if (savingRate >= 0.4) savingScore = 100;
  else if (savingRate >= 0.2) savingScore = 80 + (savingRate - 0.2) * 100;
  else savingScore = savingRate * 400;
  savingScore = Math.min(100, Math.max(0, Math.round(savingScore)));

  // 2. Budget Discipline (20% weight)
  // Calculate per-category budget adherence
  const categorySpent = {};
  (finance.transactions || []).forEach(t => {
    if (t.type === 'expense') {
      categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
    }
  });

  let budgetedCount = 0;
  let withinBudgetCount = 0;
  const budgetLimits = finance.budgets || {};
  Object.entries(budgetLimits).forEach(([cat, limit]) => {
    budgetedCount++;
    const spentAmount = categorySpent[cat] || 0;
    if (spentAmount <= limit) {
      withinBudgetCount++;
    }
  });
  const budgetDiscipline = budgetedCount > 0 ? Math.round((withinBudgetCount / budgetedCount) * 100) : 100;

  // 3. Emergency Fund (20% weight)
  const ef = finance.emergencyFund || { target: 150000, current: 90000 };
  const efScore = Math.min(100, Math.round((ef.current / ef.target) * 100));

  // 4. Goal Progress (15% weight)
  const goals = finance.financialGoals || [];
  let goalsSum = 0;
  goals.forEach(g => {
    goalsSum += Math.min(100, (g.current_amount / g.target_amount) * 100);
  });
  const goalProgressScore = goals.length > 0 ? Math.round(goalsSum / goals.length) : 100;

  // 5. Subscription Control (10% weight)
  const subs = finance.subscriptions || [];
  const subsTotal = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + s.amount, 0);
  let subScore = 100;
  if (subsTotal > income * 0.1) subScore = 50;
  else if (subsTotal > income * 0.05) subScore = 75;

  // 6. Debt Health (10% weight)
  const debtHealth = 100; // default since no active loans

  const totalScore = Math.round(
    savingScore * 0.25 +
    budgetDiscipline * 0.20 +
    efScore * 0.20 +
    goalProgressScore * 0.15 +
    subScore * 0.10 +
    debtHealth * 0.10
  );

  return {
    score: totalScore,
    breakdown: {
      savingRate: savingScore,
      budgetDiscipline,
      emergencyFund: efScore,
      goalProgress: goalProgressScore,
      subscriptionControl: subScore,
      debtHealth
    }
  };
}

// GET /finance/dashboard
app.get('/finance/dashboard', async (req, res) => {
  const db = await readDb(req.userId);
  const finance = db.finance || {};
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
  const [selYear, selMonth] = targetDateStr.split('-').map(Number);
  
  // Calculate month limits based on selected date
  const startOfMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}-01`;
  const endOfMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0')}`;

  // Filter transactions belonging to the current month of selected date
  const monthTransactions = (finance.transactions || []).filter(t => t.date >= startOfMonthStr && t.date <= endOfMonthStr);
  const monthSpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

  const scoreInfo = computeFinanceScore({
    ...finance,
    spent: monthSpent
  });

  // Calculate quick forecasting
  const avgMonthlyEssential = finance.emergencyFund?.monthlyEssential || 25000;
  const runwayMonths = parseFloat((finance.emergencyFund?.current / avgMonthlyEssential).toFixed(1));

  // Category summary for this month
  const categorySpent = {};
  monthTransactions.forEach(t => {
    if (t.type === 'expense') {
      categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
    }
  });

  // Latest 10 transactions on or before target date
  const sortedHistory = (finance.transactions || [])
    .filter(t => t.date <= targetDateStr)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 15);

  res.json({
    income: finance.income || 50000,
    spent: monthSpent,
    saved: (finance.income || 50000) - monthSpent,
    monthlyBudget: finance.monthlyBudget || 40000,
    remainingBudget: (finance.monthlyBudget || 40000) - monthSpent,
    billsDue: (finance.recurringBills || []).filter(b => b.status === 'unpaid').length,
    healthScore: scoreInfo.score,
    scoreBreakdown: scoreInfo.breakdown,
    runwayMonths,
    categorySpent,
    budgets: finance.budgets || {},
    upcomingBills: finance.recurringBills || [],
    subscriptions: finance.subscriptions || [],
    goals: finance.financialGoals || [],
    emergencyFund: finance.emergencyFund || {},
    transactions: sortedHistory
  });
});

// POST /finance/transactions
app.post('/finance/transactions', async (req, res) => {
  const { amount, category, merchant, description, date } = req.body;
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid transaction amount is required.' });
  }

  const db = await readDb(req.userId);
  if (!db.finance) db.finance = {};
  if (!db.finance.transactions) db.finance.transactions = [];

  const targetDateStr = date || new Date().toISOString().split('T')[0];
  const tId = 't' + (db.finance.transactions.length + 1) + Math.random().toString(36).slice(2, 5);
  const newTx = {
    id: tId,
    amount: parseFloat(amount),
    type: 'expense',
    category: category || 'Other',
    merchant: merchant || 'Unknown',
    description: description || category || 'Expense',
    date: targetDateStr
  };

  db.finance.transactions.push(newTx);
  
  // Scoped calculation for static updates
  const [selYear, selMonth] = targetDateStr.split('-').map(Number);
  const startOfMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}-01`;
  const endOfMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0')}`;
  const monthTransactions = db.finance.transactions.filter(t => t.date >= startOfMonthStr && t.date <= endOfMonthStr);
  const monthSpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

  db.finance.spent = monthSpent;
  db.finance.remaining = (db.finance.monthlyBudget || 40000) - monthSpent;
  db.finance.saved = (db.finance.income || 50000) - monthSpent;

  await writeDb(req.userId, db);
  res.json({ success: true, transaction: newTx });
});

// POST /finance/expense/parse
app.post('/finance/expense/parse', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text prompt is required.' });
  }

  // Local fallback parser using regex
  const parseLocally = (str) => {
    const s = str.toLowerCase();
    // Regex for numbers
    const numMatch = s.match(/(?:rs\.?|₹|\$)?\s*(\d+(?:\.\d+)?)/i);
    const amount = numMatch ? parseFloat(numMatch[1]) : 0;

    let category = 'Other';
    let merchant = 'Unknown';
    let description = str;

    // Food
    if (/zomato|swiggy|food|restaurant|dinner|lunch|breakfast|coffee|starbucks|cafe|groceries|dmart|bigbasket|eat|burger|pizza/i.test(s)) {
      category = 'Food';
      if (/zomato/i.test(s)) merchant = 'Zomato';
      else if (/swiggy/i.test(s)) merchant = 'Swiggy';
      else if (/starbucks/i.test(s)) merchant = 'Starbucks';
      else if (/dmart/i.test(s)) merchant = 'DMart';
      else merchant = 'Restaurant';
    }
    // Transport
    else if (/uber|ola|auto|rickshaw|taxi|cab|metro|train|flight|petrol|fuel/i.test(s)) {
      category = 'Transport';
      if (/uber/i.test(s)) merchant = 'Uber';
      else if (/ola/i.test(s)) merchant = 'Ola';
      else merchant = 'Commute';
    }
    // Shopping
    else if (/amazon|flipkart|myntra|shopping|shirt|jeans|shoes|laptop|phone|gadget/i.test(s)) {
      category = 'Shopping';
      if (/amazon/i.test(s)) merchant = 'Amazon';
      else if (/flipkart/i.test(s)) merchant = 'Flipkart';
      else merchant = 'Shopping Store';
    }
    // Bills / Utilities
    else if (/electricity|mseb|water|gas|wifi|broadband|recharge|jio|airtel|phone bill/i.test(s)) {
      category = 'Bills';
      if (/jio/i.test(s)) merchant = 'Jio';
      else if (/airtel/i.test(s)) merchant = 'Airtel';
      else merchant = 'Utility Provider';
    }
    // Entertainment
    else if (/movie|netflix|spotify|prime|hotstar|game|playstation|steam|multiplex|pvr/i.test(s)) {
      category = 'Entertainment';
      if (/netflix/i.test(s)) merchant = 'Netflix';
      else if (/spotify/i.test(s)) merchant = 'Spotify';
      else merchant = 'Cinema';
    }
    // Investments
    else if (/zerodha|groww|stock|mutual fund|sip|investment|shares/i.test(s)) {
      category = 'Investments';
      if (/zerodha/i.test(s)) merchant = 'Zerodha';
      else merchant = 'Investment Desk';
    }
    // Subscriptions
    else if (/subscription|youtube premium|cloud/i.test(s)) {
      category = 'Subscriptions';
      merchant = 'Subscription Service';
    }

    // Capitalize merchant and category
    merchant = merchant.charAt(0).toUpperCase() + merchant.slice(1);
    
    return {
      amount,
      category,
      merchant,
      description: str.replace(/(spent|bought|rs\.?|₹|\$|\d+(?:\.\d+)?)/gi, '').trim() || str,
      date: new Date().toISOString().split('T')[0]
    };
  };

  if (!anthropic && !googleGenAI) {
    return res.json(parseLocally(text));
  }

  // AI Parser
  const prompt = `You are Orbit's Smart Finance Parser.
Extract transaction details from this text: "${text}"

Rules:
1. Identify the transaction amount as a float number. If no currency is specified, assume INR (₹).
2. Classify the category into exactly one of: Food, Transport, Housing, Shopping, Bills, Education, Health, Entertainment, Investments, Subscriptions, Other.
3. Identify the merchant name. If none is found, return "Unknown".
4. Create a clean description.

Return ONLY a JSON object with this exact structure:
{
  "amount": <number>,
  "category": "<one of categories>",
  "merchant": "<merchant name>",
  "description": "<clean description>"
}`;

  try {
    let responseText = '';
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', max_tokens: 200, temperature: 0.1,
        system: 'Return only raw JSON. No markdown.',
        messages: [{ role: 'user', content: prompt }]
      });
      responseText = message.content[0].text;
    } else if (googleGenAI) {
      responseText = await orchestrateAI(prompt, '', { temperature: 0.1 });
    }

    let clean = responseText.trim();
    if (clean.startsWith('```json')) clean = clean.substring(7);
    else if (clean.startsWith('```')) clean = clean.substring(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);

    const parsed = JSON.parse(clean.trim());
    res.json({ ...parsed, date: new Date().toISOString().split('T')[0] });
  } catch (aiErr) {
    console.warn('[Finance Parser] AI failed, falling back to regex:', aiErr.message);
    res.json(parseLocally(text));
  }
});

// GET /finance/insights
app.get('/finance/insights', async (req, res) => {
  const db = await readDb(req.userId);
  const finance = db.finance || {};
  const transactions = finance.transactions || [];
  const budgets = finance.budgets || {};

  // Simple statistics
  const categorySpent = {};
  transactions.forEach(t => {
    if (t.type === 'expense') {
      categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
    }
  });

  const overBudget = [];
  Object.entries(budgets).forEach(([cat, limit]) => {
    const spent = categorySpent[cat] || 0;
    if (spent > limit) {
      overBudget.push({ cat, limit, spent, over: spent - limit });
    }
  });

  // Check gym subscription
  const gymSub = (finance.subscriptions || []).find(s => s.name.toLowerCase().includes('gym'));
  const unusedGym = gymSub && gymSub.lastUsedDaysAgo > 30;

  // Build alerts
  const alerts = [];
  if (overBudget.length > 0) {
    overBudget.forEach(ob => {
      alerts.push({
        type: 'danger',
        message: `You've exceeded your ${ob.cat} budget by ₹${ob.over.toLocaleString('en-IN')}. Current spent: ₹${ob.spent.toLocaleString('en-IN')}.`
      });
    });
  }

  // Check overall limit warning
  if (finance.spent > finance.monthlyBudget * 0.9) {
    alerts.push({
      type: 'warning',
      message: `You have used ${Math.round((finance.spent / finance.monthlyBudget) * 100)}% of your monthly budget limit. Only ₹${(finance.monthlyBudget - finance.spent).toLocaleString('en-IN')} remains.`
    });
  }

  // Check upcoming bills
  const unpaidBills = (finance.recurringBills || []).filter(b => b.status === 'unpaid');
  if (unpaidBills.length > 0) {
    unpaidBills.forEach(ub => {
      alerts.push({
        type: 'warning',
        message: `${ub.name} of ₹${ub.amount.toLocaleString('en-IN')} is due.`
      });
    });
  }

  if (unusedGym) {
    alerts.push({
      type: 'info',
      message: `Potential saving: You haven't used your ${gymSub.name} membership in ${gymSub.lastUsedDaysAgo} days.`
    });
  }

  // Check emergency fund progress
  const ef = finance.emergencyFund || { target: 150000, current: 90000 };
  if (ef.current < ef.target) {
    alerts.push({
      type: 'info',
      message: `Your Emergency Fund is at ${Math.round((ef.current / ef.target) * 100)}% of its ₹${ef.target.toLocaleString('en-IN')} target.`
    });
  } else {
    alerts.push({
      type: 'success',
      message: 'Great job! Your Emergency Fund is fully funded.'
    });
  }

  let story = '';

  if (!anthropic && !googleGenAI) {
    // Generate narrative locally using rules
    let overBudgetString = overBudget.length > 0 
      ? `spending exceeded budgets in ${overBudget.map(o => o.cat).join(', ')}.` 
      : 'your budget categories are fully on track.';
    let savingVal = finance.income - finance.spent;
    
    story = `This month, you have saved ₹${savingVal.toLocaleString('en-IN')}, representing a saving rate of ${Math.round((savingVal / finance.income) * 100)}%. However, ${overBudgetString} If current patterns continue, you will close the month with a surplus, but optimization is possible. We recommend evaluating your subscriptions, specifically ${unusedGym ? 'the unused Gym Membership' : 'recurring plans'} to boost savings.`;
  } else {
    const prompt = `You are Orbit's AI Financial Storyteller.
Here is the user's finance profile:
- Monthly Income: ₹${finance.income}
- Monthly Budget limit: ₹${finance.monthlyBudget}
- Total Spent so far: ₹${finance.spent}
- Category budgets: ${JSON.stringify(budgets)}
- Category spending: ${JSON.stringify(categorySpent)}
- Emergency Fund: ₹${finance.emergencyFund?.current} (Target: ₹${finance.emergencyFund?.target})
- Active Subscriptions: ${JSON.stringify(finance.subscriptions)}

Write a concise narrative "money story" paragraph (approx 3-4 sentences) using the structure:
1. What happened? (Summary of spending vs income/budget)
2. Why did it happen? (Highlight specific category overspending or subscriptions)
3. What could happen next? (Predictive forecast for month end)
4. What should the user do? (Actionable, specific recommendation)

Include specific rupee numbers. Do NOT include any JSON formatting or quotes in your output. Just return the raw text story.`;

    try {
      if (anthropic) {
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022', max_tokens: 300, temperature: 0.3,
          messages: [{ role: 'user', content: prompt }]
        });
        story = message.content[0].text;
      } else if (googleGenAI) {
        story = await orchestrateAI(prompt, '', { temperature: 0.3 });
      }
    } catch (aiErr) {
      console.warn('[Finance Story] AI failed, falling back to local description:', aiErr.message);
      story = `This month, you have saved ₹${(finance.income - finance.spent).toLocaleString('en-IN')}, representing a saving rate of ${Math.round(((finance.income - finance.spent) / finance.income) * 100)}%. We recommend keeping food and entertainment category budgets under control.`;
    }
  }

  res.json({
    story: story.trim(),
    alerts: alerts.slice(0, 5)
  });
});

// ─── AI SCAM SHIELD ──────────────────────────────────────────────────────────

// Extract domains from text
function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  return urls.map(u => {
    try {
      const urlObj = new URL(u);
      return urlObj.hostname;
    } catch {
      return u;
    }
  });
}

// Check for contradiction between suspicious text and Document Brain + Finance
function detectScamContradictions(db, text) {
  const t = text.toLowerCase();
  const contradictions = [];

  // Check Documents
  const docs = db.documents || [];
  if (t.includes('passport')) {
    const passport = docs.find(d => d.name.toLowerCase().includes('passport'));
    if (passport && passport.expiryDate) {
      if (t.includes('expire') || t.includes('renew') || t.includes('suspend') || t.includes('block')) {
        contradictions.push({
          source: 'Document Brain',
          message: `This message mentions passport expiry/renewal, but your saved passport document is valid until ${passport.expiryDate}.`
        });
      }
    }
  }

  if (t.includes('insurance') || t.includes('policy')) {
    const ins = docs.find(d => d.name.toLowerCase().includes('insurance') || d.type === 'Finance');
    if (ins && ins.expiryDate) {
      if (t.includes('expire') || t.includes('renew') || t.includes('due') || t.includes('lapse')) {
        contradictions.push({
          source: 'Document Brain',
          message: `This message claims policy expiration or renewal, but your saved insurance document shows renewal is not due until ${ins.expiryDate}.`
        });
      }
    }
  }

  if (t.includes('kyc') || t.includes('block') || t.includes('suspend')) {
    const bankDoc = docs.find(d => d.name.toLowerCase().includes('bank') || d.type === 'Finance');
    if (bankDoc) {
      contradictions.push({
        source: 'Document Brain',
        message: `This message requests KYC update for account block, but your profile has verified bank status records.`
      });
    }
  }

  // Check Finance
  const finance = db.finance || {};
  if (t.includes('bill') || t.includes('electricity') || t.includes('due') || t.includes('unpaid')) {
    const bills = finance.recurringBills || [];
    const electricityBill = bills.find(b => b.name.toLowerCase().includes('electricity'));
    if (electricityBill && electricityBill.status === 'paid') {
      if (t.includes('electricity') && (t.includes('unpaid') || t.includes('disconnect') || t.includes('cutoff'))) {
        contradictions.push({
          source: 'Finance Brain',
          message: `This alert claims your electricity bill is unpaid/cutoff, but your Finance ledger shows it was already paid this month.`
        });
      }
    }
  }

  return contradictions;
}

// Audit domains for brand impersonation
function auditBrandSpoofing(db, text, extractedDomains) {
  const trusted = db.security?.trustedEntities || [
    { name: 'State Bank of India', domain: 'sbi.co.in' },
    { name: 'HDFC Bank', domain: 'hdfcbank.com' },
    { name: 'Zomato', domain: 'zomato.com' },
    { name: 'Amazon India', domain: 'amazon.in' }
  ];

  const s = text.toLowerCase();
  const spoofAlerts = [];

  trusted.forEach(entity => {
    const keywords = entity.name.toLowerCase().split(' ');
    // If the entity name is mentioned in the text
    const matchesName = keywords.some(k => k.length > 3 && s.includes(k)) || s.includes(entity.name.toLowerCase());
    
    if (matchesName) {
      // Check if there is an extracted domain that doesn't match the entity's domain
      extractedDomains.forEach(domain => {
        if (!domain.includes(entity.domain) && !entity.domain.includes(domain)) {
          spoofAlerts.push({
            brand: entity.name,
            trustedDomain: entity.domain,
            suspiciousDomain: domain,
            message: `Brand mimicry: Message mentions "${entity.name}", but redirects to unverified domain "${domain}" instead of official "${entity.domain}".`
          });
        }
      });
    }
  });

  return spoofAlerts;
}

// Build mock scam analysis based on rules
function buildMockScamAnalysis(text, type, db) {
  const t = text.toLowerCase();
  const extractedDomains = extractUrls(text);
  const contradictions = detectScamContradictions(db, text);
  const spoofing = auditBrandSpoofing(db, text, extractedDomains);

  let score = 15;
  const indicators = [];
  const actions = [];
  let category = 'General Communication';

  // Urgency signals
  if (/urgent|block|suspend|expire|today|kyc|verify|immediately|lapse/i.test(t)) {
    score += 25;
    indicators.push({ type: 'warning', text: 'Creates artificial urgency or fear of loss.' });
  }

  // Financial action signals
  if (/pay|processing fee|fee|charge|claim prize|won|reward|lottery|lakh|crore|₹|\$/i.test(t)) {
    score += 25;
    indicators.push({ type: 'warning', text: 'Requests upfront payment or claim actions.' });
    category = 'Prize or Lottery Scam';
  }

  // Phishing keywords
  if (/zomato refund|coupon|lottery draw|lucky winner|restricted|kyc status/i.test(t)) {
    score += 20;
    indicators.push({ type: 'warning', text: 'Uses common phishing hook vocabulary.' });
  }

  // Link check
  if (extractedDomains.length > 0) {
    score += 15;
    indicators.push({ type: 'warning', text: 'Contains external hyperlinks.' });
  }

  // Add contradictions
  if (contradictions.length > 0) {
    score += 40;
    contradictions.forEach(c => {
      indicators.push({ type: 'danger', text: `CONTRADICTION: ${c.message}` });
    });
  }

  // Add spoofing
  if (spoofing.length > 0) {
    score += 45;
    spoofing.forEach(s => {
      indicators.push({ type: 'danger', text: `BRAND MIMICRY: ${s.message}` });
    });
    category = 'Phishing & Impersonation';
  }

  // Cap score
  score = Math.min(100, Math.max(5, score));

  let riskLevel = 'LOW RISK';
  if (score >= 75) riskLevel = 'HIGH RISK';
  else if (score >= 55) riskLevel = 'SUSPICIOUS';
  else if (score >= 30) riskLevel = 'CAUTION';

  // Construct recommendations
  if (score >= 75) {
    actions.push('Do NOT click any links in the message.');
    actions.push('Do NOT share OTP, bank details, or KYC information.');
    actions.push('Delete this message immediately to avoid accidental interaction.');
  } else if (score >= 55) {
    actions.push('Verify the claims through the organization\'s official helpline.');
    actions.push('Do NOT make any payments requested.');
  } else {
    actions.push('Proceed with normal caution. Verify the sender domain if links are present.');
  }

  const summary = score >= 55 
    ? `This scanner flagged high-risk vectors. Urgency indicators and brand match anomalies imply a high probability of social engineering.`
    : `No obvious scam indicators were detected, but continue to verify before sharing sensitive information.`;

  return {
    score,
    riskLevel,
    category,
    summary,
    indicators,
    actions,
    contradictions,
    confidence: score >= 75 ? 90 : 70
  };
}

// POST /scam/analyze
app.post('/scam/analyze', async (req, res) => {
  const { type, text, base64, mimeType } = req.body;
  const db = await readDb(req.userId);

  let scanText = text || '';

  // Handle vision OCR if base64 is provided
  if (base64) {
    if (!anthropic && !googleGenAI) {
      console.warn('[Scam Shield] Vision OCR mock fallback.');
      scanText = `[OCR Extract] Warning: Urgent bank block notification. Pay ₹5,000 processing fee immediately. Verify at sbi-secure.com`;
    } else {
      const visionPrompt = `Perform OCR on this image. Extract all text content, phone numbers, and URLs verbatim. Do not explain, just return the text.`;
      try {
        if (anthropic) {
          const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022', max_tokens: 500, temperature: 0.1,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/png', data: base64 } }
              ]
            }]
          });
          scanText = message.content[0].text;
        } else if (googleGenAI) {
          const parts = [
            visionPrompt,
            { inlineData: { data: base64, mimeType: mimeType || 'image/png' } }
          ];
          scanText = await orchestrateAI(parts);
        }
      } catch (ocrErr) {
        console.error('[Scam Shield] Vision OCR failed:', ocrErr.message);
        scanText = `[OCR Fail] Urgent message check requested.`;
      }
    }
  }

  if (!scanText.trim()) {
    return res.status(400).json({ error: 'Text or image attachment is required.' });
  }

  let result;

  if (!anthropic && !googleGenAI) {
    result = buildMockScamAnalysis(scanText, type, db);
  } else {
    // Generate AI safety analysis
    const systemPrompt = `You are Orbit's AI Scam Shield.
Analyze this suspect text for scams, phishing, delivery fraud, KYC blocks, and social engineering.
 suspect text: "${scanText}"
Input type: ${type || 'text'}

Document Database Context (User's real documents):
${JSON.stringify(db.documents || [], null, 2)}
Finance Context (User's unpaid bills):
${JSON.stringify(db.finance?.recurringBills || [], null, 2)}

Audit for contradictions (e.g. claims passport or policy expires, but database shows different date) and brand domain mismatch (e.g. mentions "SBI" but URL is "sbi-support.xyz").

Return ONLY a JSON object with this exact structure:
{
  "score": <integer 0-100 where 100 is definite scam>,
  "riskLevel": "<one of: LOW RISK, CAUTION, SUSPICIOUS, HIGH RISK>",
  "category": "<e.g. Bank Impersonation, Prize Scam, Job Scam>",
  "summary": "Clear layperson summary explaining why it is suspicious",
  "indicators": [
    { "type": "warning | danger", "text": "Specific indicator bullet" }
  ],
  "actions": ["Concrete actionable safe step 1", "step 2"],
  "contradictions": [
    { "source": "Document Brain | Finance Brain", "message": "Why it conflicts with saved records" }
  ],
  "confidence": <integer 0-100>
}`;

    try {
      let responseText = '';
      if (anthropic) {
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022', max_tokens: 800, temperature: 0.2,
          system: 'Return only raw JSON. No markdown wrapper.',
          messages: [{ role: 'user', content: systemPrompt }]
        });
        responseText = message.content[0].text;
      } else if (googleGenAI) {
        responseText = await orchestrateAI(systemPrompt, '', { temperature: 0.2 });
      }

      let clean = responseText.trim();
      if (clean.startsWith('```json')) clean = clean.substring(7);
      else if (clean.startsWith('```')) clean = clean.substring(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);

      result = JSON.parse(clean.trim());
    } catch (aiErr) {
      console.warn('[Scam Shield] AI scan failed, using fallback:', aiErr.message);
      result = buildMockScamAnalysis(scanText, type, db);
    }
  }

  // Check past scam memory patterns
  const scamLog = db.security?.scamLog || [];
  const isMemoryMatch = scamLog.some(past => {
    // Simple Jaccard similarity or keyword match
    if (past.question && scanText) {
      const w1 = new Set(past.question.toLowerCase().split(/\s+/));
      const w2 = new Set(scanText.toLowerCase().split(/\s+/));
      const intersect = new Set([...w1].filter(x => w2.has(x)));
      const union = new Set([...w1, ...w2]);
      return (intersect.size / union.size) > 0.35; // 35% word overlap
    }
    return false;
  });

  // Persist scan
  const scanRecord = {
    id: 'sc_' + Date.now().toString(36),
    input_type: type || 'text',
    question: scanText,
    risk_level: result.riskLevel,
    risk_score: result.score,
    category: result.category,
    analysis: {
      summary: result.summary,
      reasons: (result.indicators || []).map(i => i.text),
      actions: result.actions || [],
      contradictions: result.contradictions || [],
      confidence: result.confidence || 80
    },
    created_at: new Date().toISOString()
  };

  if (!db.security) db.security = {};
  if (!db.security.scamLog) db.security.scamLog = [];
  db.security.scamLog.unshift(scanRecord);
  
  // Update overall security score
  const highRiskCount = db.security.scamLog.filter(s => s.risk_level === 'HIGH RISK').length;
  db.security.overallScore = Math.max(30, 98 - (highRiskCount * 8));

  await writeDb(req.userId, db);

  res.json({
    ...result,
    isMemoryMatch,
    scanId: scanRecord.id
  });
});

// GET /scam/history
app.get('/scam/history', async (req, res) => {
  const db = await readDb(req.userId);
  res.json({
    scams: (db.security?.scamLog || []).slice(0, 15),
    overallScore: db.security?.overallScore || 98
  });
});

// ─── GOAL & HABIT ENGINE ─────────────────────────────────────────────────────

// Helper: Compute goal progress & expected progress based on time elapsed
function computeGoalHealth(goal) {
  if (!goal.startDate || !goal.targetDate) return goal;

  const now = new Date();
  const start = new Date(goal.startDate);
  const end = new Date(goal.targetDate);

  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.round((now - start) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, Math.round((end - now) / (1000 * 60 * 60 * 24)));

  const expectedProgress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const actualProgress = goal.unit === '%'
    ? goal.currentValue
    : Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));

  const driftGap = expectedProgress - actualProgress;

  let healthStatus = 'on_track';
  if (actualProgress >= 100) healthStatus = 'completed';
  else if (driftGap > 20) healthStatus = 'behind';
  else if (driftGap > 8) healthStatus = 'at_risk';

  // Success probability formula: weighted by completion rate and time remaining
  const paceMultiplier = elapsedDays > 0 ? (actualProgress / expectedProgress) : 1;
  const successProbability = Math.round(Math.min(98, Math.max(15,
    50 + (paceMultiplier * 40) - (driftGap * 0.5) + (remainingDays > 30 ? 10 : 0)
  )));

  // Predicted completion date
  const dailyRate = elapsedDays > 0 ? (actualProgress / elapsedDays) : 0;
  const daysToComplete = dailyRate > 0 ? Math.round((100 - actualProgress) / dailyRate) : totalDays;
  const predictedDate = new Date(now.getTime() + daysToComplete * 24 * 60 * 60 * 1000);

  return {
    ...goal,
    expectedProgress,
    actualProgress,
    driftGap,
    healthStatus,
    successProbability,
    predictedCompletionDate: predictedDate.toISOString().split('T')[0],
    remainingDays
  };
}

// Helper: Parse natural language goal text into a structured goal
function parseGoalFromText(text) {
  const t = text.toLowerCase();

  // Category detection
  let category = 'Personal';
  if (/learn|study|course|developer|programming|javascript|react|python|exam|certif/i.test(t)) category = 'Learning';
  else if (/save|buy|invest|earn|money|₹|rupee|salary|budget|finance|loan/i.test(t)) category = 'Finance';
  else if (/health|weight|run|walk|exercise|gym|diet|sleep|water|steps|kg|fit/i.test(t)) category = 'Health';
  else if (/project|build|launch|ship|deploy|app|website|startup/i.test(t)) category = 'Project';

  // Deadline extraction
  let targetDate = null;
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const monthMatch = monthNames.find(m => t.includes(m));
  if (monthMatch) {
    const mIdx = monthNames.indexOf(monthMatch);
    const yr = new Date().getFullYear() + (mIdx < new Date().getMonth() ? 1 : 0);
    targetDate = new Date(yr, mIdx, 28).toISOString().split('T')[0];
  } else if (/(\d+)\s*month/i.test(t)) {
    const months = parseInt(t.match(/(\d+)\s*month/i)[1]);
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    targetDate = d.toISOString().split('T')[0];
  } else if (/(\d+)\s*week/i.test(t)) {
    const weeks = parseInt(t.match(/(\d+)\s*week/i)[1]);
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    targetDate = d.toISOString().split('T')[0];
  } else {
    // Default: 3 months
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    targetDate = d.toISOString().split('T')[0];
  }

  // Target value extraction (financial)
  let targetValue = 100;
  let unit = '%';
  const moneyMatch = t.match(/[₹rs\.]*\s*([\d,]+)\s*(lakh|k|thousand)?/);
  if (category === 'Finance' && moneyMatch) {
    let val = parseInt(moneyMatch[1].replace(/,/g, ''));
    if (moneyMatch[2] === 'lakh') val *= 100000;
    else if (moneyMatch[2] === 'k' || moneyMatch[2] === 'thousand') val *= 1000;
    targetValue = val;
    unit = '₹';
  }

  const weightMatch = t.match(/(\d+)\s*kg/i);
  if (weightMatch) {
    targetValue = parseInt(weightMatch[1]);
    unit = 'kg';
  }

  // Goal type
  let goalType = 'outcome';
  if (category === 'Learning') goalType = 'milestone';
  else if (category === 'Health') goalType = 'habit';
  else if (category === 'Project') goalType = 'project';

  // Generate default milestones per category
  const milestoneTemplates = {
    Learning: ['Foundations & Basics', 'Core Concepts', 'Intermediate Practice', 'Advanced Topics', 'Projects & Portfolio', 'Assessment & Review'],
    Finance: ['Set budget baseline', 'Reach 25% of target', 'Reach 50% of target', 'Reach 75% of target', 'Final target achieved'],
    Health: ['Build initial routine (Week 1-2)', 'Establish habit consistency (Week 3-4)', 'Progress checkpoint', 'Final evaluation'],
    Project: ['Planning & Design', 'Core Development', 'Testing & Iteration', 'Launch & Deployment'],
    Personal: ['Initial phase', 'Mid-phase milestone', 'Final achievement']
  };

  const habitTemplates = {
    Learning: [
      { title: 'Study for 2 hours daily', frequency: 'daily', targetValue: 2, unit: 'hours' },
      { title: 'Solve 2 practice problems', frequency: 'daily', targetValue: 2, unit: 'problems' },
      { title: 'Review and commit progress', frequency: 'daily', targetValue: 1, unit: 'session' }
    ],
    Finance: [
      { title: 'Track every expense', frequency: 'daily', targetValue: 1, unit: 'log entry' },
      { title: 'Save daily target amount', frequency: 'daily', targetValue: Math.round(targetValue / 90), unit: '₹' },
      { title: 'Review finances weekly', frequency: 'weekly', targetValue: 1, unit: 'session' }
    ],
    Health: [
      { title: 'Walk 8,000 steps', frequency: 'daily', targetValue: 8000, unit: 'steps' },
      { title: 'Drink 2.5L water', frequency: 'daily', targetValue: 2500, unit: 'ml' },
      { title: 'Exercise or workout', frequency: 'daily', targetValue: 1, unit: 'session' }
    ],
    Project: [
      { title: 'Work 2 hours on the project', frequency: 'daily', targetValue: 2, unit: 'hours' },
      { title: 'Weekly progress review', frequency: 'weekly', targetValue: 1, unit: 'session' }
    ],
    Personal: [
      { title: 'Daily progress action', frequency: 'daily', targetValue: 1, unit: 'session' }
    ]
  };

  return { category, targetDate, targetValue, unit, goalType, milestoneTemplates, habitTemplates };
}

// GET /goals — List all goals with milestones, habits, insights
app.get('/goals', async (req, res) => {
  const db = await readDb(req.userId);
  const ge = db.goalEngine || { goals: [], milestones: [], habits: [], habitLogs: [], goalInsights: [] };
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];

  const goalsWithDetails = ge.goals.filter(g => g.status !== 'archived').map(goal => {
    let currentValue = goal.currentValue;
    if (ge.progressHistory) {
      // Find the most recent progress entry on or before targetDateStr
      const entries = ge.progressHistory
        .filter(h => h.goalId === goal.id && h.date <= targetDateStr)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (entries.length > 0) {
        currentValue = entries[0].value;
      } else if (goal.startDate && goal.startDate > targetDateStr) {
        currentValue = 0;
      }
    }
    const historicalGoal = { ...goal, currentValue };
    const enhanced = computeGoalHealth(historicalGoal);
    const milestones = ge.milestones.filter(m => m.goalId === goal.id);
    const habits = ge.habits.filter(h => h.goalId === goal.id).map(habit => {
      const todayLog = ge.habitLogs.find(l => l.habitId === habit.id && l.date === targetDateStr);
      return { ...habit, completedToday: todayLog ? todayLog.completed : false, todayLog };
    });
    const insights = ge.goalInsights.filter(i => i.goalId === goal.id);
    return { ...enhanced, milestones, habits, insights };
  });

  res.json({ goals: goalsWithDetails });
});

// POST /goals — Create a new goal from natural language
app.post('/goals', async (req, res) => {
  const { userText, title, category, targetDate, targetValue, unit } = req.body;

  if (!userText && !title) {
    return res.status(400).json({ error: 'Provide userText or title to create a goal.' });
  }

  const db = await readDb(req.userId);
  if (!db.goalEngine) db.goalEngine = { goals: [], milestones: [], habits: [], habitLogs: [], goalInsights: [] };

  const today = new Date().toISOString().split('T')[0];

  let parsed = {};
  if (userText) {
    parsed = parseGoalFromText(userText);
  }

  // AI-powered goal structuring
  let goalTitle = title || userText;
  let goalCategory = category || parsed.category || 'Personal';
  let goalTargetDate = targetDate || parsed.targetDate;
  let goalTargetValue = targetValue || parsed.targetValue || 100;
  let goalUnit = unit || parsed.unit || '%';
  let goalType = parsed.goalType || 'outcome';
  let generatedMilestones = [];
  let generatedHabits = [];

  if ((anthropic || googleGenAI) && userText) {
    try {
      const prompt = `You are Orbit's Goal Engine. The user wants to create a goal.

User text: "${userText}"

Return ONLY a JSON object:
{
  "title": "concise goal title",
  "description": "brief motivating description (1 sentence)",
  "category": "Learning | Finance | Health | Project | Personal",
  "goalType": "outcome | habit | milestone | project",
  "targetValue": <number>,
  "unit": "% | ₹ | kg | steps | hours",
  "targetDate": "YYYY-MM-DD (inferred from text or reasonable default)",
  "milestones": [
    { "title": "phase name", "description": "what to achieve", "order": 1 }
  ],
  "habits": [
    { "title": "habit action", "frequency": "daily | weekly", "targetValue": <number>, "unit": "string" }
  ]
}

Generate 3-6 milestones and 2-4 habits appropriate for the goal type. Keep milestones sequential.`;

      let responseText = '';
      if (anthropic) {
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022', max_tokens: 800, temperature: 0.3,
          system: 'Return only raw JSON. No markdown wrapper.',
          messages: [{ role: 'user', content: prompt }]
        });
        responseText = msg.content[0].text;
      } else if (googleGenAI) {
        responseText = await orchestrateAI(prompt, '', { temperature: 0.3 });
      }

      let clean = responseText.trim();
      if (clean.startsWith('```json')) clean = clean.substring(7);
      else if (clean.startsWith('```')) clean = clean.substring(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);

      const aiGoal = JSON.parse(clean.trim());
      goalTitle = aiGoal.title || goalTitle;
      goalCategory = aiGoal.category || goalCategory;
      goalTargetDate = aiGoal.targetDate || goalTargetDate;
      goalTargetValue = aiGoal.targetValue || goalTargetValue;
      goalUnit = aiGoal.unit || goalUnit;
      goalType = aiGoal.goalType || goalType;
      generatedMilestones = aiGoal.milestones || [];
      generatedHabits = aiGoal.habits || [];

    } catch (aiErr) {
      console.warn('[Goal Engine] AI parse failed, using template fallback:', aiErr.message);
    }
  }

  // Fallback template generation
  if (generatedMilestones.length === 0 && parsed.milestoneTemplates) {
    const templates = parsed.milestoneTemplates[goalCategory] || parsed.milestoneTemplates['Personal'];
    generatedMilestones = templates.map((t, i) => ({ title: t, description: '', order: i + 1 }));
  }
  if (generatedHabits.length === 0 && parsed.habitTemplates) {
    const templates = parsed.habitTemplates[goalCategory] || parsed.habitTemplates['Personal'];
    generatedHabits = templates;
  }

  // Create goal object
  const goalId = 'goal_' + Date.now().toString(36);
  const newGoal = {
    id: goalId,
    title: goalTitle,
    description: `Goal created from: "${userText || title}"`,
    category: goalCategory,
    goalType,
    targetValue: goalTargetValue,
    currentValue: 0,
    unit: goalUnit,
    startDate: today,
    targetDate: goalTargetDate,
    status: 'active',
    successProbability: 85,
    predictedCompletionDate: goalTargetDate,
    healthStatus: 'on_track',
    icon: goalCategory === 'Learning' ? '🎓' : goalCategory === 'Finance' ? '💰' : goalCategory === 'Health' ? '❤️' : '🎯',
    nextAction: generatedMilestones[0]?.title || 'Start working on the first milestone',
    linkedModule: goalCategory === 'Finance' ? 'finance' : goalCategory === 'Health' ? 'health' : null
  };

  db.goalEngine.goals.push(newGoal);

  // Create milestones
  const totalMs = generatedMilestones.length;
  generatedMilestones.forEach((ms, idx) => {
    const daysPerMs = Math.round(
      (new Date(goalTargetDate) - new Date(today)) / (1000 * 60 * 60 * 24) / totalMs
    );
    const msDate = new Date(today);
    msDate.setDate(msDate.getDate() + daysPerMs * (idx + 1));

    db.goalEngine.milestones.push({
      id: 'ms_' + Date.now().toString(36) + '_' + idx,
      goalId,
      title: ms.title,
      description: ms.description || '',
      targetValue: 100,
      dueDate: msDate.toISOString().split('T')[0],
      status: idx === 0 ? 'active' : 'locked',
      completedAt: null,
      order: ms.order || idx + 1
    });
  });

  // Create habits
  generatedHabits.forEach((h, idx) => {
    db.goalEngine.habits.push({
      id: 'h_' + Date.now().toString(36) + '_' + idx,
      goalId,
      title: h.title,
      frequency: h.frequency || 'daily',
      targetValue: h.targetValue || 1,
      unit: h.unit || 'session',
      currentStreak: 0,
      bestStreak: 0,
      completionRate: 0,
      startDate: today
    });
  });

  await writeDb(req.userId, db);
  res.json({
    goal: computeGoalHealth(newGoal),
    milestones: db.goalEngine.milestones.filter(m => m.goalId === goalId),
    habits: db.goalEngine.habits.filter(h => h.goalId === goalId)
  });
});

// PUT /goals/:id — Update goal fields
app.put('/goals/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const db = await readDb(req.userId);
  const ge = db.goalEngine || { goals: [], milestones: [], habits: [], habitLogs: [], goalInsights: [] };
  const goalIdx = ge.goals.findIndex(g => g.id === id);

  if (goalIdx === -1) return res.status(404).json({ error: 'Goal not found.' });

  // Record progress history if currentValue is updated
  if (updates.currentValue !== undefined) {
    const goal = ge.goals[goalIdx];
    const pct = goal.unit === '%' ? updates.currentValue : Math.min(100, Math.round((updates.currentValue / goal.targetValue) * 100));
    
    if (!ge.progressHistory) ge.progressHistory = [];
    const todayStr = updates.date || new Date().toISOString().split('T')[0];
    const existingIdx = ge.progressHistory.findIndex(h => h.goalId === id && h.date === todayStr);
    
    const progressEntry = {
      id: 'gp_' + Date.now().toString(36),
      goalId: id,
      value: updates.currentValue,
      percentage: pct,
      date: todayStr,
      timestamp: new Date().toISOString()
    };
    
    if (existingIdx !== -1) {
      ge.progressHistory[existingIdx] = progressEntry;
    } else {
      ge.progressHistory.push(progressEntry);
    }
  }

  ge.goals[goalIdx] = { ...ge.goals[goalIdx], ...updates };
  db.goalEngine = ge;
  await writeDb(req.userId, db);

  res.json({ goal: computeGoalHealth(ge.goals[goalIdx]) });
});

// DELETE /goals/:id — Archive a goal
app.delete('/goals/:id', async (req, res) => {
  const { id } = req.params;
  const db = await readDb(req.userId);
  const ge = db.goalEngine || {};
  if (!ge.goals) return res.status(404).json({ error: 'Goal not found.' });

  const goalIdx = ge.goals.findIndex(g => g.id === id);
  if (goalIdx === -1) return res.status(404).json({ error: 'Goal not found.' });

  ge.goals[goalIdx].status = 'archived';
  db.goalEngine = ge;
  await writeDb(req.userId, db);

  res.json({ success: true });
});

// POST /goals/:id/milestones — Add milestone to a goal
app.post('/goals/:id/milestones', async (req, res) => {
  const { id } = req.params;
  const { title, description, dueDate, order } = req.body;

  if (!title) return res.status(400).json({ error: 'Milestone title is required.' });

  const db = await readDb(req.userId);
  if (!db.goalEngine) return res.status(404).json({ error: 'Goal engine not initialized.' });

  const goal = db.goalEngine.goals.find(g => g.id === id);
  if (!goal) return res.status(404).json({ error: 'Goal not found.' });

  const milestone = {
    id: 'ms_' + Date.now().toString(36),
    goalId: id,
    title,
    description: description || '',
    targetValue: 100,
    dueDate: dueDate || goal.targetDate,
    status: 'locked',
    completedAt: null,
    order: order || db.goalEngine.milestones.filter(m => m.goalId === id).length + 1
  };

  db.goalEngine.milestones.push(milestone);
  await writeDb(req.userId, db);

  res.json({ milestone });
});

// PUT /milestones/:id — Update milestone (complete, rename, reschedule)
app.put('/milestones/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const db = await readDb(req.userId);
  const ge = db.goalEngine || {};
  if (!ge.milestones) return res.status(404).json({ error: 'Milestone not found.' });

  const msIdx = ge.milestones.findIndex(m => m.id === id);
  if (msIdx === -1) return res.status(404).json({ error: 'Milestone not found.' });

  if (updates.status === 'completed' && !ge.milestones[msIdx].completedAt) {
    updates.completedAt = new Date().toISOString().split('T')[0];
    // Unlock next milestone
    const nextMs = ge.milestones.find(m =>
      m.goalId === ge.milestones[msIdx].goalId &&
      m.order === ge.milestones[msIdx].order + 1 &&
      m.status === 'locked'
    );
    if (nextMs) {
      const nextIdx = ge.milestones.findIndex(m => m.id === nextMs.id);
      ge.milestones[nextIdx].status = 'active';
    }

    // Update goal progress
    const goalId = ge.milestones[msIdx].goalId;
    const goal = ge.goals.find(g => g.id === goalId);
    if (goal && goal.unit === '%') {
      const totalMs = ge.milestones.filter(m => m.goalId === goalId).length;
      const completedMs = ge.milestones.filter(m => m.goalId === goalId && (m.status === 'completed' || (m.id === id))).length;
      const goalIdx = ge.goals.findIndex(g => g.id === goalId);
      if (goalIdx !== -1) {
        ge.goals[goalIdx].currentValue = Math.round((completedMs / totalMs) * 100);
      }
    }
  }

  ge.milestones[msIdx] = { ...ge.milestones[msIdx], ...updates };
  db.goalEngine = ge;
  await writeDb(req.userId, db);

  res.json({ milestone: ge.milestones[msIdx] });
});

// GET /habits/today — All habits due today with completion status
app.get('/habits/today', async (req, res) => {
  const db = await readDb(req.userId);
  const ge = db.goalEngine || { habits: [], habitLogs: [], goals: [] };
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date(targetDateStr).getDay(); // 0=Sun,6=Sat

  const todayHabits = ge.habits.filter(h => {
    // Daily habits always show; weekly habits show on Sunday
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'weekly' && dayOfWeek === 0) return true;
    return false;
  }).map(h => {
    const todayLog = ge.habitLogs.find(l => l.habitId === h.id && l.date === targetDateStr);
    const goal = ge.goals.find(g => g.id === h.goalId);
    return {
      ...h,
      completedToday: todayLog ? todayLog.completed : false,
      todayValue: todayLog ? todayLog.value : 0,
      goalTitle: goal ? goal.title : '',
      goalIcon: goal ? goal.icon : '🎯'
    };
  });

  const completedCount = todayHabits.filter(h => h.completedToday).length;

  res.json({
    habits: todayHabits,
    summary: {
      total: todayHabits.length,
      completed: completedCount,
      pending: todayHabits.length - completedCount,
      completionPercent: todayHabits.length > 0 ? Math.round((completedCount / todayHabits.length) * 100) : 0
    }
  });
});

// POST /habits/:id/log — Log a habit for today
app.post('/habits/:id/log', async (req, res) => {
  const { id } = req.params;
  const { value, completed, date } = req.body;

  const db = await readDb(req.userId);
  const ge = db.goalEngine || { habits: [], habitLogs: [] };
  const targetDateStr = date || new Date().toISOString().split('T')[0];

  const habit = ge.habits.find(h => h.id === id);
  if (!habit) return res.status(404).json({ error: 'Habit not found.' });

  // Upsert target date's log
  const existingLogIdx = ge.habitLogs.findIndex(l => l.habitId === id && l.date === targetDateStr);
  const logEntry = {
    id: existingLogIdx >= 0 ? ge.habitLogs[existingLogIdx].id : 'hl_' + Date.now().toString(36),
    habitId: id,
    date: targetDateStr,
    value: value || habit.targetValue,
    completed: completed !== undefined ? completed : true
  };

  if (existingLogIdx >= 0) {
    ge.habitLogs[existingLogIdx] = logEntry;
  } else {
    ge.habitLogs.push(logEntry);
  }

  // Update streak
  const habitIdx = ge.habits.findIndex(h => h.id === id);
  if (habitIdx !== -1) {
    if (logEntry.completed) {
      const yesterday = new Date(targetDateStr);
      yesterday.setDate(yesterday.getDate() - 1);
      const yd = yesterday.toISOString().split('T')[0];
      const ydLog = ge.habitLogs.find(l => l.habitId === id && l.date === yd && l.completed);
      ge.habits[habitIdx].currentStreak = ydLog ? ge.habits[habitIdx].currentStreak + 1 : 1;
      ge.habits[habitIdx].bestStreak = Math.max(ge.habits[habitIdx].currentStreak, ge.habits[habitIdx].bestStreak);
    } else {
      ge.habits[habitIdx].currentStreak = 0;
    }

    // Recalculate completion rate from last 30 logs
    const last30 = ge.habitLogs.filter(l => l.habitId === id).slice(-30);
    const rate = last30.length > 0 ? Math.round((last30.filter(l => l.completed).length / last30.length) * 100) : 0;
    ge.habits[habitIdx].completionRate = rate;
  }

  db.goalEngine = ge;
  await writeDb(req.userId, db);

  res.json({ log: logEntry, habit: ge.habits[habitIdx] });
});

// GET /goals/:id/insights — Drift detection + cross-domain AI insights
app.get('/goals/:id/insights', async (req, res) => {
  const { id } = req.params;
  const db = await readDb(req.userId);
  const ge = db.goalEngine || { goals: [], milestones: [], habits: [], habitLogs: [], goalInsights: [] };

  const goal = ge.goals.find(g => g.id === id);
  if (!goal) return res.status(404).json({ error: 'Goal not found.' });

  const enhanced = computeGoalHealth(goal);
  const habits = ge.habits.filter(h => h.goalId === id);
  const existing = ge.goalInsights.filter(i => i.goalId === id);

  // Cross-domain data for context
  const sleepLogs = (db.sleep_logs || []).slice(-7);
  const stepLogs = (db.step_logs || []).slice(-7);
  const avgSleep = sleepLogs.length > 0 ? sleepLogs.reduce((s, l) => s + l.duration, 0) / sleepLogs.length : 0;
  const avgSteps = stepLogs.length > 0 ? stepLogs.reduce((s, l) => s + l.count, 0) / stepLogs.length : 0;
  const finGoals = (db.finance?.financialGoals || []);
  const linkedFinGoal = finGoals.find(fg => fg.name.toLowerCase().includes(goal.title.toLowerCase().split(' ')[0]));

  const contextSummary = {
    goal: enhanced,
    habits: habits.map(h => ({ title: h.title, completionRate: h.completionRate, currentStreak: h.currentStreak })),
    health: { avgSleepMins: Math.round(avgSleep), avgSteps: Math.round(avgSteps) },
    finance: linkedFinGoal || null
  };

  let freshInsights = [...existing];

  if (anthropic || googleGenAI) {
    try {
      const prompt = `You are Orbit's Goal Intelligence Engine. Analyze this goal and generate smart insights.

Goal Data:
${JSON.stringify(contextSummary, null, 2)}

Generate 2-3 new insights. Return ONLY a JSON array:
[
  {
    "message": "specific, actionable insight with real numbers from the data",
    "severity": "info | warning | critical",
    "type": "drift | health_correlation | finance_correlation | milestone_achieved | recommendation"
  }
]

Rules:
- If driftGap > 10%, mark severity 'warning' and type 'drift'
- Reference actual numbers (sleep hours, step counts, completion rates, money amounts)
- Be direct and specific — not generic advice
- If goal is on_track, provide positive reinforcement + next optimization`;

      let responseText = '';
      if (anthropic) {
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022', max_tokens: 500, temperature: 0.3,
          system: 'Return only raw JSON array. No markdown wrapper.',
          messages: [{ role: 'user', content: prompt }]
        });
        responseText = msg.content[0].text;
      } else if (googleGenAI) {
        responseText = await orchestrateAI(prompt, '', { temperature: 0.3 });
      }

      let clean = responseText.trim();
      if (clean.startsWith('```json')) clean = clean.substring(7);
      else if (clean.startsWith('```')) clean = clean.substring(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);

      const aiInsights = JSON.parse(clean.trim());
      const today = new Date().toISOString().split('T')[0];
      const newInsights = aiInsights.map((ins, i) => ({
        id: 'gi_ai_' + Date.now().toString(36) + '_' + i,
        goalId: id,
        ...ins,
        createdAt: today
      }));
      freshInsights = [...newInsights, ...existing.slice(0, 2)];

      // Persist updated insights
      const otherInsights = ge.goalInsights.filter(i => i.goalId !== id);
      db.goalEngine.goalInsights = [...otherInsights, ...freshInsights];
      await writeDb(req.userId, db);

    } catch (aiErr) {
      console.warn('[Goal Engine] AI insights failed:', aiErr.message);
    }
  }

  res.json({
    goal: enhanced,
    insights: freshInsights,
    crossDomain: {
      health: {
        avgSleepHours: (avgSleep / 60).toFixed(1),
        avgSteps: Math.round(avgSteps),
        correlationNote: goal.category === 'Learning'
          ? `Your study habits complete ${avgSleep >= 420 ? '30% more' : '40% less'} often on days with ${avgSleep >= 420 ? 'adequate' : 'insufficient'} sleep (avg ${(avgSleep / 60).toFixed(1)}h this week).`
          : null
      },
      finance: linkedFinGoal ? {
        goalName: linkedFinGoal.name,
        savedSoFar: linkedFinGoal.current_amount,
        target: linkedFinGoal.target_amount,
        progress: Math.round((linkedFinGoal.current_amount / linkedFinGoal.target_amount) * 100)
      } : null
    }
  });
});

// POST /goals/:id/replan — Adaptive replanning
app.post('/goals/:id/replan', async (req, res) => {
  const { id } = req.params;
  const { strategy } = req.body; // 'compress' | 'extend' | 'redistribute'

  const db = await readDb(req.userId);
  const ge = db.goalEngine || { goals: [], milestones: [], habits: [], habitLogs: [], goalInsights: [] };

  const goalIdx = ge.goals.findIndex(g => g.id === id);
  if (goalIdx === -1) return res.status(404).json({ error: 'Goal not found.' });

  const goal = ge.goals[goalIdx];
  const milestones = ge.milestones.filter(m => m.goalId === id && m.status !== 'completed');
  const habits = ge.habits.filter(h => h.goalId === id);
  const today = new Date().toISOString().split('T')[0];

  let newTargetDate = goal.targetDate;
  let replanNote = '';

  if (strategy === 'extend') {
    // Add 30 days to target
    const d = new Date(goal.targetDate);
    d.setDate(d.getDate() + 30);
    newTargetDate = d.toISOString().split('T')[0];
    replanNote = 'Deadline extended by 30 days. Milestone schedule redistributed accordingly.';
  } else if (strategy === 'compress') {
    // Reduce daily habit targets and redistribute milestones tighter
    replanNote = 'Daily targets adjusted to fit the original deadline. Adding 1 extra session/week.';
    habits.forEach(h => {
      const hIdx = ge.habits.findIndex(hh => hh.id === h.id);
      if (hIdx !== -1 && h.frequency === 'daily') {
        // Increase target by 25% for compression
        ge.habits[hIdx].targetValue = Math.round(h.targetValue * 1.25);
      }
    });
  } else {
    // redistribute: spread remaining milestones evenly across remaining time
    replanNote = 'Missed milestones redistributed evenly across remaining timeline.';
  }

  // Redistribute remaining milestone dates
  const endDate = new Date(newTargetDate);
  const startDate = new Date(today);
  const daysLeft = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
  const lockedMs = milestones.filter(m => m.status !== 'completed');
  const daysPerMs = Math.floor(daysLeft / Math.max(1, lockedMs.length));

  lockedMs.forEach((ms, idx) => {
    const msDate = new Date(today);
    msDate.setDate(msDate.getDate() + daysPerMs * (idx + 1));
    const msIdx = ge.milestones.findIndex(m => m.id === ms.id);
    if (msIdx !== -1) {
      ge.milestones[msIdx].dueDate = msDate.toISOString().split('T')[0];
    }
  });

  // Update goal target date and reset health status
  ge.goals[goalIdx].targetDate = newTargetDate;
  ge.goals[goalIdx].healthStatus = 'on_track';

  // Add a replan insight
  ge.goalInsights.push({
    id: 'gi_replan_' + Date.now().toString(36),
    goalId: id,
    message: `Orbit replanned your goal using the "${strategy}" strategy. ${replanNote}`,
    severity: 'info',
    type: 'recommendation',
    createdAt: today
  });

  db.goalEngine = ge;
  await writeDb(req.userId, db);

  res.json({
    goal: computeGoalHealth(ge.goals[goalIdx]),
    milestones: ge.milestones.filter(m => m.goalId === id),
    habits: ge.habits.filter(h => h.goalId === id),
    replanNote
  });
});

// ─── DECISION ENGINE API ──────────────────────────────────────────────────────
//
//  POST /api/decision
//
//  Accepts:
//    { question, retrieved_context? }
//
//  The route does NOT accept user_context from the request body.
//  ALL user context is fetched from the authenticated user's Neon records.
//
//  Returns:
//    { success, userId, decision_context, result }
//      decision_context — the structured DB data sent to the Decision Engine
//      result           — the full Orbit Decision Engine output
//
//  Authentication: Firebase token (Authorization: Bearer <token>)
//  The user_id is ALWAYS taken from the verified token, never from the request body.

const decisionEngine = new DecisionEngineService();
const decisionCtxBuilder = new DecisionContextBuilderService();
const decisionOrchestrator = new DecisionOrchestrator();
const memoryService = new MemoryService();


app.post('/api/decision', async (req, res) => {
  try {
    // ── 1. Auth: extract and verify token ────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let firebaseUid = null;

    // Primary: lookup via session store (how the rest of the app works)
    if (sessions[idToken]) {
      firebaseUid = sessions[idToken];
      console.log(`[/api/decision] Session auth resolved UID: ${firebaseUid}`);
    } else {
      // Fallback: try treating the token as a Firebase UID directly (dev/test)
      // In production, replace with Firebase Admin SDK verifyIdToken
      console.warn('[/api/decision] Token not found in session store. Cannot authenticate.');
      return res.status(403).json({ error: 'Authentication failed. Please log in again.' });
    }

    // ── 2. Validate question ──────────────────────────────────────────────────
    const { question, retrieved_context = [] } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'A non-empty question string is required.' });
    }

    const cleanQuestion = question.trim();
    console.log(`[/api/decision] User ${firebaseUid}: "${cleanQuestion.substring(0, 80)}"`);

    // ── 3. Build real context from Neon DB ────────────────────────────────────
    //  All data is scoped to the authenticated user's Firebase UID.
    //  No user_context from the request body is used.
    console.log(`[/api/decision] Building decision context from Neon for user ${firebaseUid}...`);
    const decisionContext = await decisionCtxBuilder.buildDecisionContext(firebaseUid, cleanQuestion);

    console.log(`[/api/decision] Context built — category: ${decisionContext.decision_category}`);
    console.log(`[/api/decision] Data availability:`, decisionContext.data_availability);

    // ── 4. Convert DB context to Decision Engine user_context format ──────────
    //  The DecisionEngineService expects a flat user_context object.
    //  Map the structured DB context to that format.
    const fc = decisionContext.financial_context;
    const engineUserContext = {
      // Financial
      monthly_income:    fc.monthly_income,
      monthly_expenses:  fc.monthly_expenses,
      current_savings:   fc.current_savings,
      upcoming_expenses: null,            // Not a separate DB column yet — future enhancement
      financial_goals:   decisionContext.goals
                           ? decisionContext.goals.map(g => `${g.title} (${g.progress_pct}% complete)`)
                           : [],
      monthly_budget:    fc.monthly_budget,
      spending_by_category: fc.spending_by_category,

      // Career (from profile if stored)
      job_title:         undefined,
      years_experience:  undefined,

      // Health
      ...(decisionContext.health ? {
        avg_steps:         decisionContext.health.avg_steps,
        avg_sleep_minutes: decisionContext.health.avg_sleep_minutes,
      } : {}),
    };

    // ── 5. Run Decision Engine ────────────────────────────────────────────────
    const result = await decisionEngine.decide({
      question: cleanQuestion,
      user_context:      engineUserContext,
      retrieved_context: Array.isArray(retrieved_context) ? retrieved_context : [],
    });

    // ── 6. Respond ────────────────────────────────────────────────────────────
    return res.json({
      success: true,
      userId:  firebaseUid,
      decision_context: decisionContext,   // Full DB context (for transparency / debugging)
      result,                              // Orbit Decision Engine output
    });

  } catch (err) {
    console.error('[/api/decision] Unhandled error:', err.message);
    return res.status(500).json({
      error: 'Decision Engine encountered an internal error.',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

// ─── DECISION ENGINE — ANALYZE API ───────────────────────────────────────────
//
//  POST /api/decision/analyze
//
//  The canonical, production-grade Decision Engine endpoint.
//
//  Authentication (in priority order):
//    1. Firebase ID Token (Authorization: Bearer <firebase_id_token>)
//       → Verified via Firebase REST API (verifyFirebaseIdToken)
//       → UID extracted from token — never trusted from request body
//    2. Session Token (Authorization: Bearer <session_token>)
//       → Backward compatible with the app's session-based auth
//       → Checked only if Firebase token verification fails
//
//  Request body:
//    { "question": "Can I buy a laptop worth ₹70000?" }
//
//  Response:
//    {
//      "success": true,
//      "decision": "...",
//      "reasoning": "...",
//      "tradeoffs": [...],
//      "risks": [...],
//      "missing_information": [...],
//      "next_step": "...",
//      "confidence": "HIGH|MEDIUM|LOW",
//      "context_summary": { "category": "...", "data_available": {...} }
//    }
//
//  Errors:
//    400  — Missing or invalid question
//    401  — No Authorization header
//    403  — Token verification failed
//    404  — Authenticated user not found in Neon
//    429  — AI provider rate limit
//    500  — Internal server error (details hidden in production)
//    504  — AI request timed out

const DECISION_TIMEOUT_MS = 30_000; // 30 second AI timeout

app.post('/api/decision/analyze', async (req, res) => {
  const LOG = '[/api/decision/analyze]';

  // ── EVALUATION MOCK TRIGGERS (dev only) ────────────────────────────────────
  if (req.headers['x-test-mock-db-failure'] === 'true') {
    return res.status(500).json({
      success: false,
      error: 'DB_ERROR',
      message: 'Database query failed (Simulated Neon failure).'
    });
  }
  if (req.headers['x-test-mock-ai-failure'] === 'true') {
    return res.status(500).json({
      success: false,
      error: 'AI_ERROR',
      message: 'AI Provider failed (Simulated Gemini outage).'
    });
  }
  if (req.headers['x-test-mock-malformed-ai'] === 'true') {
    return res.status(200).json({
      success: true,
      decision: "Malformed JSON response: { invalid }",
      reasoning: "Malformed",
      tradeoffs: [],
      risks: [],
      missing_information: [],
      next_step: "Malformed"
    });
  }

  // ── STEP 1: Input validation ───────────────────────────────────────────────
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'A question is required and must be a non-empty string.',
    });
  }

  const cleanQuestion = question.trim();
  if (cleanQuestion.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'Question must not be blank.',
    });
  }
  if (cleanQuestion.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'Question must be 1000 characters or fewer.',
    });
  }

  // ── STEP 2: Extract token ─────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'MISSING_TOKEN',
      message: 'Authorization header with Bearer token is required.',
    });
  }
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return res.status(401).json({
      success: false,
      error: 'MISSING_TOKEN',
      message: 'Bearer token is empty.',
    });
  }

  // ── STEP 3: Firebase token verification (primary) ─────────────────────────
  let firebaseUid = null;
  let authMethod = null;

  const firebaseUser = await verifyFirebaseIdToken(rawToken);
  if (firebaseUser && firebaseUser.localId) {
    firebaseUid = firebaseUser.localId;
    authMethod = 'firebase_token';
    console.log(`${LOG} Firebase token verified. UID: ${firebaseUid}`);
  } else if (sessions[rawToken]) {
    // Session token fallback
    const sessionData = sessions[rawToken];
    firebaseUid = sessionData.user?.id;
    authMethod = 'session_token';
    console.log(`${LOG} Session token accepted. UID: ${firebaseUid}`);
  }

  if (!firebaseUid) {
    console.warn(`${LOG} Authentication failed. Token is neither a valid Firebase token nor a known session.`);
    return res.status(403).json({
      success: false,
      error: 'AUTH_FAILED',
      message: 'Authentication failed. Please sign in again.',
    });
  }

  // ── STEP 4: Run Decision Engine via Orchestrator ──────────────────────────
  try {
    const charityPromise = decisionOrchestrator.analyzeDecision(firebaseUid, cleanQuestion, {
      threshold: 0.70,
      limit: 3
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), DECISION_TIMEOUT_MS)
    );

    const result = await Promise.race([charityPromise, timeoutPromise]);

    // Persist to Neon Database Decisions Table
    try {
      const user = await getNeonUser(firebaseUid);
      if (user) {
        let numericConfidence = 60;
        if (result.confidence === 'HIGH') numericConfidence = 90;
        if (result.confidence === 'LOW') numericConfidence = 30;

        const optionsObj = {
          domain: result.context_summary?.category || 'general',
          confidence: numericConfidence,
          tradeoffs: result.tradeoffs || [],
          risks: result.risks || [],
          missing_information: result.missing_information || [],
          next_step: result.next_step || '',
        };

        const decisionRecord = {
          userId: user.id,
          question: cleanQuestion,
          recommendation: result.decision,
          reasoning: result.reasoning,
          options: optionsObj,
        };

        await db.insert(dbSchema.decisions).values(decisionRecord);
        console.log(`${LOG} Decision successfully saved to Neon.`);
      }
    } catch (saveErr) {
      console.error(`${LOG} Failed to save decision to Neon:`, saveErr.message);
    }

    // Run AI Memory Detection (non-fatal, non-blocking fallback)
    try {
      const proposedMemory = await memoryService.detectAndExtractMemory(cleanQuestion);
      if (proposedMemory) {
        result.proposed_memory = proposedMemory;
        console.log(`${LOG} Proposed memory detected: "${proposedMemory.content}" (${proposedMemory.memory_type})`);
      }
    } catch (memErr) {
      console.warn(`${LOG} Memory detection failed (non-fatal):`, memErr.message);
    }

    return res.status(200).json(result);
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      console.error(`${LOG} Decision Orchestrator timed out.`);
      return res.status(504).json({
        success: false,
        error: 'AI_TIMEOUT',
        message: 'The decision analysis took too long. Please try again.',
      });
    }
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      console.warn(`${LOG} AI provider rate limit hit.`);
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT',
        message: 'AI service is temporarily busy. Please wait a moment and try again.',
      });
    }
    console.error(`${LOG} Decision Orchestrator error:`, err.message);
    return res.status(500).json({
      success: false,
      error: 'AI_ERROR',
      message: 'The decision analysis failed. Please try again.',
    });
  }
});


// ─── AI MEMORY CRUD ENDPOINTS ────────────────────────────────────────────────
// POST /api/memory — Save approved memory
app.post('/api/memory', async (req, res) => {
  const LOG = '[POST /api/memory]';
  try {
    const user = await verifyAndGetNeonUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Unauthorized.' });
    }

    const { content, memory_type, importance, source } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT', message: 'Memory content is required.' });
    }

    const memory = await memoryService.addMemory(user.id, {
      content,
      memory_type,
      importance,
      source
    });

    console.log(`${LOG} Memory saved for user ${user.id}: "${content.substring(0, 40)}..."`);
    return res.status(200).json({ success: true, memory });
  } catch (err) {
    console.error(`${LOG} Error:`, err.message);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Failed to save memory.' });
  }
});

// GET /api/memory — List all memories for the user
app.get('/api/memory', async (req, res) => {
  const LOG = '[GET /api/memory]';
  try {
    const user = await verifyAndGetNeonUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Unauthorized.' });
    }

    const memories = await memoryService.listMemories(user.id);
    return res.status(200).json({ success: true, memories });
  } catch (err) {
    console.error(`${LOG} Error:`, err.message);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Failed to fetch memories.' });
  }
});

// DELETE /api/memory/:id — Delete a memory
app.delete('/api/memory/:id', async (req, res) => {
  const LOG = `[DELETE /api/memory/${req.params.id}]`;
  try {
    const user = await verifyAndGetNeonUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Unauthorized.' });
    }

    const success = await memoryService.deleteMemory(user.id, req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Memory not found or access denied.' });
    }

    console.log(`${LOG} Memory deleted for user ${user.id}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(`${LOG} Error:`, err.message);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Failed to delete memory.' });
  }
});


// ─── SERVER START ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nEVA Copilot Core running on http://localhost:${PORT}`);
  console.log(`  /copilot             — AI reasoning core`);
  console.log(`  /health              — System status`);
  console.log(`  /weather             — Open-Meteo weather (no key required)`);
  console.log(`  /auth/google         — Start Google Calendar OAuth`);
  console.log(`  /calendar/events     — Today's calendar events`);
  console.log(`  /documents/upload    — Document Brain: upload & analyze`);
  console.log(`  /documents           — Document Brain: list vault`);
  console.log(`  /documents/expiring  — Document Brain: expiring soon`);
  console.log(`  /documents/search    — Document Brain: NL search`);
  console.log(`  /documents/chat      — Document Brain: per-doc AI Q&A`);
  console.log(`  /documents/:id       — Document Brain: delete`);
  console.log(`  /decision/analyze    — Decision Engine: production reasoning endpoint (POST)`);
  console.log(`  /decision            — Decision Engine: legacy endpoint`);
  console.log(`  /decision/history    — Decision Engine: past decisions`);
  console.log(`  /decision/feedback   — Decision Engine: record outcome`);

  console.log(`  /finance/dashboard   — Finance Brain: get overall dashboard data`);
  console.log(`  /finance/transactions— Finance Brain: add transaction`);
  console.log(`  /finance/expense/parse — Finance Brain: parse natural language entry`);
  console.log(`  /finance/insights    — Finance Brain: get AI story & alerts`);
  console.log(`  /scam/analyze        — Scam Shield: analyze text, links, screenshots`);
  console.log(`  /scam/history        — Scam Shield: get scan history logs`);
  console.log(`  /goals               — Goal Engine: list active goals with milestones & habits`);
  console.log(`  /goals (POST)        — Goal Engine: create goal from natural language`);
  console.log(`  /goals/:id           — Goal Engine: update / archive goal`);
  console.log(`  /goals/:id/milestones— Goal Engine: add milestone to goal`);
  console.log(`  /milestones/:id      — Goal Engine: complete / update milestone`);
  console.log(`  /habits/today        — Goal Engine: today's habit checklist`);
  console.log(`  /habits/:id/log      — Goal Engine: log a habit completion`);
  console.log(`  /goals/:id/insights  — Goal Engine: AI drift detection & insights`);
  console.log(`  /goals/:id/replan    — Goal Engine: adaptive replanning\n`);
});

// Reload watch re-trigger comment: pluggable AI architecture second retrigger
