import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { DEMO_MODE } from '../../lib/supabase';
import { loginLimiter } from '../../lib/rateLimiter';
import { validateEmail, validatePassword } from '../../lib/validators';

const LoginPage = () => {
  const { login }  = useAuth();
  const { data }   = useData();
  const navigate   = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (ev) => {
    ev.preventDefault();

    // Field validation
    const errs = {};
    const ee = validateEmail(email);
    const pe = validatePassword(password);
    if (ee) errs.email    = ee;
    if (pe) errs.password = pe;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Rate limit
    const rl = loginLimiter.check(email.toLowerCase());
    if (!rl.allowed) {
      setErrors({ general: `Too many attempts. Wait ${rl.waitSeconds}s before trying again.` });
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      // In demo mode pass the in-memory data so login can match users
      const res = await login(email, password, data);
      if (!res.success) {
        setErrors({ general: res.error || 'Invalid email or password.' });
        return;
      }
      if (!res.role) {
        setErrors({ general: 'Account exists but profile is not set up. Contact your manager.' });
        return;
      }
      // ⚡ INSTANT REDIRECT: Navigate immediately using the role from login()
      const defaultPage = res.role === 'employee' ? 'tasks' : 'overview';
      navigate(`/${res.role}/${defaultPage}`, { replace: true });
    } catch (err) {
      console.error('[TeamFlow] Login error:', err);
      setErrors({ general: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Quick-login: fill email + password then auto-submit
  const quickLogin = async (e, p) => {
    setEmail(e); setPassword(p);
    setErrors({});
    const rl = loginLimiter.check(e.toLowerCase());
    if (!rl.allowed) { setErrors({ general: `Rate limit hit. Try in ${rl.waitSeconds}s.` }); return; }
    setLoading(true);
    try {
      const res = await login(e, p, data);
      if (!res.success) {
        setErrors({ general: res.error });
        return;
      }
      if (!res.role) {
        setErrors({ general: 'Profile not found. Contact your manager.' });
        return;
      }
      // ⚡ INSTANT REDIRECT
      const defaultPage = res.role === 'employee' ? 'tasks' : 'overview';
      navigate(`/${res.role}/${defaultPage}`, { replace: true });
    } catch (err) {
      setErrors({ general: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Show demo users: manager first, then one employee, one client
  const demoUsers = DEMO_MODE
    ? [
        data.users.find(u => u.role === 'manager'),
        data.users.find(u => u.role === 'employee'),
        data.users.find(u => u.role === 'client'),
      ].filter(Boolean)
    : [];

  return (
    <div className="login-page">
      {/* ── Left panel ── */}
      <div className="login-left">
        <div className="login-bg">
          <div className="login-blob b1" />
          <div className="login-blob b2" />
        </div>
        <div className="login-brand">
          <div className="brand-icon">🌊</div>
          <h1>TeamFlow</h1>
          <p>The ultimate workspace for elite agencies.</p>
        </div>
        <div className="login-features">
          <div className="login-feat">
            <span className="lf-icon">⚡</span>
            <div className="lf-text"><strong>Real-time Tracking</strong>Monitor tasks &amp; progress instantly.</div>
          </div>
          <div className="login-feat">
            <span className="lf-icon">📅</span>
            <div className="lf-text"><strong>Master Planner</strong>Sync calendars and meetings globally.</div>
          </div>
          <div className="login-feat">
            <span className="lf-icon">🔐</span>
            <div className="lf-text"><strong>Secure Access</strong>Role-based auth — manager, employee, client.</div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-form-wrap">
          <h2>Welcome Back</h2>
          <p className="sub">Sign in to your workspace to continue.</p>

          {/* Demo banner */}
          {DEMO_MODE && (
            <div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 8, padding: '8px 14px', marginBottom: 20, fontSize: '0.78rem', color: '#a78bfa' }}>
              🧪 <strong>Demo Mode</strong> — Supabase not connected. Data stored in localStorage.
            </div>
          )}

          <form onSubmit={handleLogin} noValidate>
            {errors.general && (
              <div className="login-error" style={{ display: 'flex' }}>{errors.general}</div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                id="login-email"
                type="email"
                className={`tf-input${errors.email ? ' input-error' : ''}`}
                placeholder="name@company.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors({}); }}
                autoComplete="email"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                id="login-password"
                type="password"
                className={`tf-input${errors.password ? ' input-error' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors({}); }}
                autoComplete="current-password"
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <button id="login-submit" type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Quick Access (demo mode only) */}
          {DEMO_MODE && demoUsers.length > 0 && (
            <div className="quick-creds" style={{ marginTop: 24 }}>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>⚡ Quick Access Demo</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {demoUsers.map(u => (
                  <div
                    key={u.id}
                    className="cred-pill"
                    onClick={() => quickLogin(u.email, u.password)}
                    title={`${u.email} / ${u.password}`}
                  >
                    <span className="cp-role" style={{ textTransform: 'capitalize', fontWeight: 700 }}>{u.role}</span>
                    &nbsp;{u.name.split(' ')[0]}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!DEMO_MODE && (
            <p style={{ marginTop: 24, fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Don't have credentials? Ask your manager to create an account.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
