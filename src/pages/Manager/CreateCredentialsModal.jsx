import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { credentialLimiter } from '../../lib/rateLimiter';
import { validateCredentialForm, getPasswordStrength } from '../../lib/validators';
import { useData } from '../../context/DataContext';

const DEPT_OPTIONS = ['Social Media', 'SEO', 'Web Dev', 'Ads', 'Blogs', 'Reports', 'Management'];
const COLORS       = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#6366f1'];

const CreateCredentialsModal = ({ onClose }) => {
  const { data, refreshData } = useData();
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'employee',
    dept: '', clientAccountId: '', color: COLORS[0],
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const strength = getPasswordStrength(form.password);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const fieldErrors = validateCredentialForm(form);
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }

    // Rate-limit credential creation
    const rl = credentialLimiter.check('manager');
    if (!rl.allowed) {
      setErrors({ general: `Rate limit hit. Wait ${rl.waitSeconds}s before creating another account.` });
      return;
    }

    setLoading(true); setErrors({});
    try {
      // Call Supabase Edge Function (create-user) to securely create the auth account
      // If the function is not deployed, this will throw "Failed to send a request to the Edge Function"
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
        body: {
          email:          form.email.trim().toLowerCase(),
          password:       form.password,
          name:           form.name.trim(),
          role:           form.role,
          dept:           form.role === 'employee' ? form.dept    : null,
          clientAccountId: form.role === 'client'  ? form.clientAccountId : null,
          color:          form.role === 'employee' ? form.color   : null,
          avatar:         form.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        },
      });

      if (fnError) {
        // Fallback for non-deployed functions
        if (fnError.message?.includes('Failed to send a request') || fnError.message?.includes('not found')) {
           console.warn('[TeamFlow] Edge Function "create-user" not found. Simulating success for demo purposes.') ;
           setSuccess(`✨ [SIMULATED] Account created for ${form.name}. (Note: Since the Edge Function is not deployed, no real auth account was created. Run 'supabase functions deploy create-user' to enable real login.)`);
           setForm({ name: '', email: '', password: '', role: 'employee', dept: '', clientAccountId: '', color: COLORS[0] });
           return;
        }
        throw new Error(fnError.message || 'Failed to create account');
      }
      if (fnData?.error) throw new Error(fnData.error);

      setSuccess(`✅ Account created for ${form.name}. They can now log in with their email and password.`);
      setForm({ name: '', email: '', password: '', role: 'employee', dept: '', clientAccountId: '', color: COLORS[0] });
      await refreshData();
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay anim-fade-in" style={{ backgroundColor: 'rgba(5,6,12,0.94)', backdropFilter: 'blur(16px)' }}>
      <div className="modal-content" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card" style={{ background: '#161829', border: '1px solid rgba(255,255,255,0.08)', padding: '30px', borderRadius: 12, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 22, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>

           <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff' }}>Create Login Credentials</div>
              <div style={{ fontSize: '0.78rem', color: '#8890b0' }}>Manager-only: provision access for employees or clients</div>
            </div>
          </div>

          {errors.general && <div className="login-error" style={{ display: 'flex', marginBottom: 16 }}>{errors.general}</div>}
          {success        && <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', borderRadius: 8, padding: '12px 16px', color: '#10b981', fontSize: '0.85rem', marginBottom: 16 }}>{success}</div>}

          <form onSubmit={handleSubmit} noValidate>
            {/* Role selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['employee', 'client'].map(r => (
                <button key={r} type="button"
                  onClick={() => set('role', r)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    background: form.role === r ? '#7c3aed' : '#1e2035',
                    color: form.role === r ? '#fff' : '#8890b0',
                    border: `1px solid ${form.role === r ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {r === 'employee' ? 'Employee' : 'Client'}
                </button>
              ))}
            </div>

            {/* Name */}
            <div className="form-group mb16">
              <label className="text-sm fw600 mb6 display-block" style={{ color: '#8890b0' }}>Full Name *</label>
              <input className={`tf-input h44${errors.name ? ' input-error' : ''}`}
                style={{ background: '#1e2035', border: `1px solid ${errors.name ? '#ef4444' : 'rgba(255,255,255,0.08)'}`, color: '#fff' }}
                placeholder="e.g. Jane Smith" value={form.name}
                onChange={e => set('name', e.target.value)} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            {/* Email */}
            <div className="form-group mb16">
              <label className="text-sm fw600 mb6 display-block" style={{ color: '#8890b0' }}>Email Address *</label>
              <input type="email" className={`tf-input h44${errors.email ? ' input-error' : ''}`}
                style={{ background: '#1e2035', border: `1px solid ${errors.email ? '#ef4444' : 'rgba(255,255,255,0.08)'}`, color: '#fff' }}
                placeholder="jane@company.com" value={form.email}
                onChange={e => set('email', e.target.value)} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-group mb16">
              <label className="text-sm fw600 mb6 display-block" style={{ color: '#8890b0' }}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'}
                  className={`tf-input h44${errors.password ? ' input-error' : ''}`}
                  style={{ background: '#1e2035', border: `1px solid ${errors.password ? '#ef4444' : 'rgba(255,255,255,0.08)'}`, color: '#fff', paddingRight: 40 }}
                  placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password}
                  onChange={e => set('password', e.target.value)} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8890b0', cursor: 'pointer', fontSize: 14 }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
              {/* Strength meter */}
              {form.password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: strength.color }}>{strength.label}</span>
                </div>
              )}
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            {/* Employee-specific: dept + color */}
            {form.role === 'employee' && (
              <div className="grid-2 gap16 mb16">
                <div className="form-group">
                  <label className="text-sm fw600 mb6 display-block" style={{ color: '#8890b0' }}>Department *</label>
                  <select className={`tf-input h44${errors.dept ? ' input-error' : ''}`}
                    style={{ background: '#1e2035', border: `1px solid ${errors.dept ? '#ef4444' : 'rgba(255,255,255,1)'}`, color: '#fff' }}
                    value={form.dept} onChange={e => set('dept', e.target.value)}>
                    <option value="">Select dept</option>
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.dept && <span className="field-error">{errors.dept}</span>}
                </div>
                <div className="form-group">
                  <label className="text-sm fw600 mb6 display-block" style={{ color: '#8890b0' }}>Avatar Color</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8 }}>
                    {COLORS.map(c => (
                      <div key={c} onClick={() => set('color', c)} style={{
                        width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                        border: form.color === c ? '3px solid #fff' : '3px solid transparent',
                        boxSizing: 'border-box', transition: 'border 0.2s',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Client-specific: link to client account */}
            {form.role === 'client' && (
              <div className="form-group mb16">
                <label className="text-sm fw600 mb6 display-block" style={{ color: '#8890b0' }}>Client Account *</label>
                <select className={`tf-input h44${errors.clientAccountId ? ' input-error' : ''}`}
                  style={{ background: '#1e2035', border: `1px solid ${errors.clientAccountId ? '#ef4444' : 'rgba(255,255,255,1)'}`, color: '#fff' }}
                  value={form.clientAccountId} onChange={e => set('clientAccountId', e.target.value)}>
                  <option value="">Link to client account</option>
                  {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.clientAccountId && <span className="field-error">{errors.clientAccountId}</span>}
              </div>
            )}

            {/* Preview avatar */}
            {form.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: form.role === 'employee' ? form.color : '#7c3aed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.75rem', color: '#fff',
                }}>
                  {form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>{form.name || '—'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#8890b0' }}>{form.email || '—'} · {form.role}</div>
                </div>
              </div>
            )}

            <button type="submit" className="btn" disabled={loading}
              style={{ width: '100%', height: 50, background: '#7c3aed', color: '#fff', fontWeight: 800, fontSize: '0.9rem', borderRadius: 8, justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating Account…' : ' Create Credentials'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCredentialsModal;
