import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Landing from './landing/Landing.jsx'
import Login from './landing/Login.jsx'
import Signup from './landing/Signup.jsx'
import { AuthProvider } from './context/AuthContext'

// Global fetch interceptor — attaches Firebase ID token + credentials to all backend requests
import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const originalFetch = window.fetch;

window.fetch = async function (url, options = {}) {
  const urlStr = url.toString();
  const isBackendRequest =
    urlStr.startsWith(API_URL) ||
    urlStr.startsWith('http://localhost:5001') ||
    (!urlStr.startsWith('http') && !urlStr.startsWith('//'));

  if (isBackendRequest) {
    options.credentials = 'include';

    // Attach Firebase ID token so auth works cross-origin (no cookie dependency)
    try {
      const currentUser = auth.currentUser;
      if (currentUser && !options.headers?.Authorization && !options.headers?.authorization) {
        const idToken = await currentUser.getIdToken();
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${idToken}`,
        };
      }
    } catch {
      // Token unavailable (user signed out) — let the request proceed unauthenticated
    }
  }

  return originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/app/*" element={<App />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
