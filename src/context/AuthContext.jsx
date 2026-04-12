import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, DEMO_MODE } from '../lib/supabase';

const AuthContext = createContext();
const SESSION_KEY = 'tf_session';

/* ── Supabase-mode helpers ─────────────────────────────────── */
const fetchProfile = async (authUser, setUser) => {
  if (!authUser) {
    setUser(null);
    return null;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error || !profile) {
      console.warn('[TeamFlow] Profile not found for UID:', authUser.id, error?.message);
      setUser(null);
      return null;
    }

    const userData = {
      userId: authUser.id,
      email: authUser.email,
      name: profile.name,
      role: profile.role,
      avatar: profile.avatar,
      dept: profile.dept,
      color: profile.color,
      clientId: profile.client_id,
      isActive: profile.is_active,
    };

    setUser(userData);
    // ⚡ CACHE: Persist profile for instant load on refresh
    localStorage.setItem('tf_profile', JSON.stringify(userData));
    return userData;
  } catch (err) {
    console.error('[TeamFlow] fetchProfile unexpected error:', err);
    setUser(null);
    return null;
  }
};

/* ── Provider ──────────────────────────────────────────────── */
export const AuthProvider = ({ children }) => {
  // Track whether login() already set the user (skip redundant onAuthStateChange fetch)
  const loginHandledRef = useRef(false);

  const [user, setUser] = useState(() => {
    // ⚡ INSTANT LOAD: Check cache immediately during initialization
    if (DEMO_MODE) {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } else {
      const cached = localStorage.getItem('tf_profile');
      try { return cached ? JSON.parse(cached) : null; } catch (e) { return null; }
    }
  });

  const [loading, setLoading] = useState(!user); // If we have a cached user, don't start in loading state

  /* ── DEMO MODE: restore from sessionStorage ── */
  useEffect(() => {
    if (!DEMO_MODE) return;
    setLoading(false);
  }, []);

  /* ── SUPABASE MODE: resolve real session ── */
  useEffect(() => {
    if (DEMO_MODE) return;

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        setLoading(false);
        return;
      }
      if (session?.user) {
        // ⚡ CACHE: Check for locally stored profile first for instant load
        const cached = localStorage.getItem('tf_profile');
        if (cached) {
          try {
            const p = JSON.parse(cached);
            if (p.userId === session.user.id) {
              setUser(p);
              setLoading(false); // ⚡ OPTIMIZATION: Stop blocking UI if we have cache
            }
          } catch (e) { }
        }
        // Then fetch fresh to ensure sync
        await fetchProfile(session.user, setUser);
      } else {
        // ⚡ CLEANUP: If Supabase says no session, clear any stale cache
        setUser(null);
        localStorage.removeItem('tf_profile');
      }
      setLoading(false);
    });

    // ⚡ SAFETY FALLBACK: Ensure the UI is unblocked after a reasonable delay 
    // even if the network is extremely slow or getSession hangs.
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // ⚡ SKIP if login() already handled this (avoids redundant 1-2s fetch)
          if (loginHandledRef.current) {
            loginHandledRef.current = false;
            return;
          }
          await fetchProfile(session.user, setUser);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('tf_profile');
          localStorage.removeItem('tf_sb_cache');
        }
      }
    );
    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  /* ── login ── */
  const login = async (email, password, TF_DATA) => {
    if (DEMO_MODE) {
      // Demo: match against in-memory users list
      const candidate = TF_DATA?.users?.find(
        u => u.email.toLowerCase() === email.toLowerCase()
      );
      if (candidate && candidate.password === password) {
        const session = {
          userId: candidate.id,
          name: candidate.name,
          role: candidate.role,
          avatar: candidate.avatar,
          email: candidate.email,
          color: candidate.color,
          dept: candidate.dept,
          clientId: candidate.clientId,
        };
        setUser(session);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { success: true, role: candidate.role };
      }
      return { success: false, error: 'Invalid credentials' };
    }

    // Supabase mode
    // ⚡ Signal that we will handle user-setting ourselves, skip onAuthStateChange
    loginHandledRef.current = true;

    try {
      // ⚡ TIMEOUT: Abort if Supabase takes longer than 10 seconds
      const authPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign-in timed out. Check your connection and try again.')), 10000)
      );
      const { data: { session }, error } = await Promise.race([authPromise, timeoutPromise]);

      if (error) {
        loginHandledRef.current = false;
        return { success: false, error: error.message };
      }

      if (session?.user) {
        // ⚡ CACHE-FIRST: Try instant redirect from cached profile
        const cached = localStorage.getItem('tf_profile');
        if (cached) {
          try {
            const p = JSON.parse(cached);
            if (p.userId === session.user.id) {
              setUser(p);
              setLoading(false);
              // ⚡ Background refresh: update cache silently without blocking UI
              fetchProfile(session.user, setUser);
              return { success: true, role: p.role };
            }
          } catch (_) { /* fall through to fresh fetch */ }
        }
        // No valid cache — fetch once (login() handles it, onAuthStateChange won't duplicate)
        const userData = await fetchProfile(session.user, setUser);
        return { success: true, role: userData?.role };
      }

      return { success: true };
    } catch (err) {
      loginHandledRef.current = false;
      return { success: false, error: err.message || 'Sign-in failed. Please try again.' };
    }
  };

  /* ── logout ── */
  const logout = () => {
    console.info('[TeamFlow] Initiating sign-out...');
    try {
      if (!DEMO_MODE) {
        supabase.auth.signOut().catch(err => {
          console.warn('[TeamFlow] Supabase sign-out warning:', err.message);
        });
      }
    } catch (err) {
      console.error('[TeamFlow] Sign-out caught error:', err);
    } finally {
      // ⚡ FAST RE-LOGIN: Keep tf_profile and tf_sb_cache so re-login is instant.
      // Only clear auth session keys — data caches are harmless and speed up re-login.
      sessionStorage.clear();
      localStorage.removeItem('tf_session');
      
      setUser(null);
      setLoading(false);
      
      console.info('[TeamFlow] Auth state cleared — React Router will redirect to /login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, DEMO_MODE }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
