import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Landing from './landing/Landing.jsx'
import Login from './landing/Login.jsx'
import Signup from './landing/Signup.jsx'
import { AuthProvider } from './context/AuthContext'

// Global fetch interceptor to support credentials (cookies) in cross-origin requests
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const urlStr = url.toString();
  if (urlStr.startsWith(API_URL) || urlStr.startsWith('http://localhost:5001') || urlStr.startsWith('/') || !urlStr.startsWith('http')) {
    options.credentials = 'include';
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
