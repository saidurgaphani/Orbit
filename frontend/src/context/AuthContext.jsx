import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  auth, 
  googleProvider,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup 
} from '../firebase';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';

const AuthContext = createContext(null);

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sync Firebase authentication state to the React context and the Backend session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const res = await fetch(`${BACKEND}/api/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
          const data = await res.json();
          if ((data.authenticated || data.success) && data.user) {
            setUser(data.user);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (err) {
          console.error('Error syncing auth state with backend:', err);
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        try {
          await fetch(`${BACKEND}/api/auth/logout`, { method: 'POST' });
        } catch (err) {
          console.error('Error clearing backend session:', err);
        }
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(`${BACKEND}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed backend authentication synchronization.');
    }
    setUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  };

  const signup = async (name, email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    await updateProfile(firebaseUser, { displayName: name });
    
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(`${BACKEND}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed backend authentication synchronization.');
    }
    setUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  };

  const loginWithGoogle = async () => {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const firebaseUser = userCredential.user;
    
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(`${BACKEND}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed backend authentication synchronization.');
    }
    setUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  };

  const logout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-alabaster flex flex-col items-center justify-center font-serif text-charcoal border-[16px] border-charcoal m-0 p-8 box-border">
        <div className="text-center space-y-4 max-w-sm">
          <h1 className="text-6xl font-black tracking-tighter uppercase leading-none">Orbit</h1>
          <div className="w-16 h-[2px] bg-charcoal mx-auto my-6"></div>
          <p className="text-xs uppercase tracking-[0.2em] font-mono font-bold animate-pulse">
            Initializing Personal Platform System
          </p>
          <p className="text-[10px] text-charcoal/40 font-mono tracking-widest">
            SECURE PORT: 5001 // SYSTEM STABLE
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, signup, logout, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
