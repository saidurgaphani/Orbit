import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const getFriendlyError = (errKey) => {
    if (!errKey) return '';
    if (errKey === 'access_denied') return 'Google login was cancelled by the user.';
    if (errKey === 'email_not_provided') return 'Could not retrieve email from Google profile.';
    return decodeURIComponent(errKey);
  };

  return (
    <div className="min-h-screen bg-alabaster text-charcoal flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background shape details for subtle print look */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5 border-[16px] border-charcoal m-0"></div>
      
      <div className="w-full max-w-md border border-charcoal p-8 md:p-10 bg-alabaster shadow-[4px_4px_0px_0px_rgba(39,39,39,1)] relative z-10">
        
        {/* Logo and Headings */}
        <div className="text-center space-y-2 mb-8">
          <Link to="/" className="inline-block hover:opacity-85 transition-opacity">
            <h1 className="text-5xl font-serif font-black tracking-tighter uppercase leading-none">EVA</h1>
          </Link>
          <div className="w-12 h-[1px] bg-charcoal mx-auto my-3"></div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-forest">
            System Authentication Portal
          </p>
          <h2 className="text-lg font-serif font-bold italic tracking-wide mt-1">
            "Welcome back. Identify yourself."
          </h2>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="border border-terracotta bg-terracotta/5 text-terracotta p-4 mb-6 text-xs font-mono font-bold uppercase tracking-wider relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-terracotta"></div>
            {getFriendlyError(error)}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col">
            <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-charcoal/60 mb-2">
              Registered Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-b border-charcoal bg-transparent text-charcoal py-2 px-1 focus:outline-none focus:border-forest font-sans text-sm transition-colors placeholder:text-charcoal/20"
              placeholder="e.g. user@example.com"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-charcoal/60 mb-2">
              Secret Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-b border-charcoal bg-transparent text-charcoal py-2 px-1 focus:outline-none focus:border-forest font-sans text-sm transition-colors placeholder:text-charcoal/20"
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-charcoal text-alabaster border border-charcoal py-3.5 px-4 hover:bg-forest hover:border-forest transition-colors font-mono font-bold text-xs uppercase tracking-[0.2em]"
          >
            {loading ? 'Verifying Credentials...' : 'Enter Platform'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-6">
          <div className="absolute w-full border-t border-charcoal/15"></div>
          <span className="relative bg-alabaster px-4 text-[9px] font-mono uppercase font-bold text-charcoal/40 tracking-widest">
            or continue via
          </span>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-charcoal bg-alabaster text-charcoal py-3.5 px-4 hover:bg-charcoal hover:text-alabaster transition-colors font-mono font-bold text-xs uppercase tracking-widest disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer Link */}
        <div className="mt-8 text-center text-[10px] font-mono uppercase tracking-wider text-charcoal/50">
          New to the platform?{' '}
          <Link to="/auth/signup" className="text-forest hover:underline font-bold">
            Begin with yourself
          </Link>
        </div>
      </div>
    </div>
  );
}
