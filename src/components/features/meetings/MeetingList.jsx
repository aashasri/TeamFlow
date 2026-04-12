import React, { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { meetingLimiter } from '../../../lib/rateLimiter';
import { validateMeetingForm } from '../../../lib/validators';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MeetingList = () => {
  const { data, addMeeting, cancelMeeting } = useData();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '', type: 'internal', clientId: '', attendees: [], link: '', desc: '' });

  const employees = data.users.filter(u => u.role === 'employee');
  const clients   = data.clients;
  const now = new Date();
  const sortMeetings = (arr) => {
    const upcoming = arr.filter(m => new Date(m.date + 'T23:59:59') >= now).sort((a, b) => a.date.localeCompare(b.date));
    const past = arr.filter(m => new Date(m.date + 'T23:59:59') < now).sort((a, b) => b.date.localeCompare(a.date));
    return [...upcoming, ...past];
  };
  const allMeetings = sortMeetings([...data.meetings]).filter(m => m.status !== 'canceled');
  const myMeetings  = sortMeetings(data.meetings.filter(m => m.attendees.includes(user?.userId))).filter(m => m.status !== 'canceled');
  const meetDisplayList = isManager ? allMeetings : myMeetings;

  // Next upcoming meeting
  const nextMeeting = meetDisplayList.find(m => new Date(m.date + 'T23:59:59') >= now);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };
  const toggleAttendee = (uid) => setForm(f => ({ ...f, attendees: f.attendees.includes(uid) ? f.attendees.filter(id => id !== uid) : [...f.attendees, uid] }));

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = validateMeetingForm(form);
    if (form.attendees.length === 0 && isManager) errs.attendees = 'Select at least one attendee';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const rl = meetingLimiter.check(user?.userId);
    if (!rl.allowed) { setErrors({ general: `Rate limit. Wait ${rl.waitSeconds}s.` }); return; }
    setLoading(true);
    const attendees = isManager ? form.attendees : [user.userId, ...form.attendees.filter(id => id !== user.userId)];
    const { error } = await addMeeting({ ...form, attendees, createdBy: user?.userId });
    setLoading(false);
    if (error) {
      setErrors({ general: 'Failed to create meeting: ' + (error.message || 'Unknown error') });
      return;
    }
    setForm({ title: '', date: '', time: '', type: 'internal', clientId: '', attendees: [], link: '', desc: '' });
    setErrors({}); setShowForm(false);
  };

  const handleCancel = async (meetingId) => {
    if (window.confirm('Cancel this meeting?')) await cancelMeeting(meetingId);
  };

  return (
    <div>
      {/* ── Upcoming Meeting Banner ── */}
      {nextMeeting && (() => {
        const d = new Date(nextMeeting.date + 'T00:00:00');
        const isCreator = nextMeeting.createdBy === user?.userId || (isManager && !nextMeeting.createdBy);
        return (
          <div style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
            borderRadius: 14, padding: '20px 28px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
              <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>{d.getDate()}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{MONTHS[d.getMonth()]}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}> Next Upcoming Meeting</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>{nextMeeting.title}</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                {nextMeeting.time} · {nextMeeting.attendees.length} attendee{nextMeeting.attendees.length !== 1 ? 's' : ''} · {nextMeeting.type === 'client' ? ' Client' : ' Internal'}
              </div>
            </div>
            {nextMeeting.link && (
              <a href={nextMeeting.link} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: '#10b981', color: '#fff', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'none', marginRight: 10 }}>
                🔗 Join Meeting
              </a>
            )}
            {isCreator && (
              <button onClick={() => handleCancel(nextMeeting.id)}
                style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                ✕ Cancel Meeting
              </button>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* ── Left: Meeting List ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{isManager ? ' All Meetings' : '📅 My Schedule'}</div>
            <button className="btn" onClick={() => setShowForm(s => !s)}
              style={{ background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '0.82rem', padding: '8px 18px', borderRadius: 8 }}>
              {showForm ? '✕ Cancel' : '＋ Create Meeting'}
            </button>
          </div>

          {meetDisplayList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: '#8890b0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <p>No meetings scheduled</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {meetDisplayList.map(m => {
                const d = new Date(m.date + 'T00:00:00');
                const isPast = d < now && d.toDateString() !== now.toDateString();
                const isToday = d.toDateString() === now.toDateString();
                const isCanceled = m.status === 'canceled';
                const isCreator = m.createdBy === user?.userId || (isManager && !m.createdBy);
                const profiles = m.attendees.map(id => data.users.find(u => u.id === id)).filter(Boolean);
                return (
                  <div key={m.id} className="card" style={{ 
                    padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', 
                    opacity: (isPast || isCanceled) ? 0.5 : 1, 
                    border: isCanceled ? '1px solid #ef4444' : (isToday ? '1px solid #10b981' : '1px solid var(--border)'), 
                    boxShadow: isToday && !isCanceled ? '0 0 16px rgba(16,185,129,0.1)' : 'none',
                    background: isCanceled ? 'rgba(239,68,68,0.02)' : 'var(--bg2)'
                  }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: isCanceled ? '#555' : (m.type === 'client' ? 'var(--blue)' : 'var(--accent)'), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
                      <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>{MONTHS[d.getMonth()]}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isCanceled ? '#8890b0' : '#fff', textDecoration: isCanceled ? 'line-through' : 'none' }}>{m.title}</div>
                        {isToday && !isCanceled && <span style={{ background: '#10b98122', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>TODAY</span>}
                        {isCanceled && <span style={{ background: '#ef444422', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>CANCELED</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#8890b0', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span>⏰ {m.time}</span>
                        <span>👥 {m.attendees.length}</span>
                        <span style={{ color: m.type === 'client' ? 'var(--blue)' : '#555' }}>{m.type === 'client' ? '👔 Client' : '🏢 Internal'}</span>
                      </div>
                      {m.desc && <div style={{ fontSize: '0.82rem', color: '#c0c5d8', marginBottom: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6 }}>{m.desc}</div>}
                      <div style={{ display: 'flex', gap: 4, marginBottom: m.link ? 8 : 0 }}>
                        {profiles.slice(0, 5).map(p => (
                          <div key={p.id} title={p.name} style={{ width: 22, height: 22, borderRadius: '50%', background: p.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: '#fff' }}>{p.avatar}</div>
                        ))}
                        {profiles.length > 5 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1e2035', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#8890b0' }}>+{profiles.length - 5}</div>}
                      </div>
                      {m.link && !isCanceled && (
                        <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(124,58,237,0.1)', color: '#a78bfa', padding: '4px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none' }}>
                          🔗 Join Call
                        </a>
                      )}
                    </div>
                    {isCreator && !isPast && !isCanceled && (
                      <button onClick={() => handleCancel(m.id)} title="Cancel this meeting"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '5px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        ✕
                      </button>
                    )}
                    {isPast && <span style={{ fontSize: '0.68rem', color: '#555', flexShrink: 0 }}>Past</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Create Form or Upcoming sidebar ── */}
        <div>
          {showForm ? (
            <div className="card" style={{ background: '#161829', border: '1px solid rgba(255,255,255,0.08)', padding: 24, borderRadius: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', marginBottom: 20 }}> Schedule Meeting</div>
              {errors.general && <div className="login-error" style={{ display: 'flex', marginBottom: 14 }}>{errors.general}</div>}
              <form onSubmit={handleCreate} noValidate>
                <div className="form-group mb16">
                  <label style={lbl}>Meeting Title *</label>
                  <input className="tf-input h44" style={{ ...inp, borderColor: errors.title ? '#ef4444' : 'rgba(255,255,255,0.08)' }}
                    placeholder="e.g. Weekly Standup" value={form.title} onChange={e => set('title', e.target.value)} />
                  {errors.title && <span className="field-error">{errors.title}</span>}
                </div>
                <div className="form-group mb16">
                  <label style={lbl}>Description / Context</label>
                  <textarea className="tf-input" rows="2" style={{ ...inp, height: 'auto', padding: 10, resize: 'none' }} placeholder="Brief agenda..." value={form.desc || ''} onChange={e => set('desc', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div><label style={lbl}>Date *</label>
                    <input type="date" className="tf-input h44" style={{ ...inp, borderColor: errors.date ? '#ef4444' : 'rgba(255,255,255,0.08)' }} value={form.date} onChange={e => set('date', e.target.value)} />
                  </div>
                  <div><label style={lbl}>Time *</label>
                    <input type="time" className="tf-input h44" style={{ ...inp, borderColor: errors.time ? '#ef4444' : 'rgba(255,255,255,0.08)' }} value={form.time} onChange={e => set('time', e.target.value)} />
                  </div>
                </div>
                <div className="form-group mb16">
                  <label style={lbl}>Meeting Link</label>
                  <input type="url" className="tf-input h44" style={inp} placeholder="https://meet.google.com/..." value={form.link || ''} onChange={e => set('link', e.target.value)} />
                </div>
                <div className="form-group mb16">
                  <label style={lbl}>Type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['internal','client'].map(t => (
                      <button key={t} type="button" onClick={() => set('type', t)}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.type === t ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`, background: form.type === t ? '#7c3aed' : '#1e2035', color: form.type === t ? '#fff' : '#8890b0', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                        {t === 'internal' ? ' Internal' : ' Client'}
                      </button>
                    ))}
                  </div>
                </div>
                {form.type === 'client' && (
                  <div className="form-group mb16">
                    <label style={lbl}>Client</label>
                    <select className="tf-input h44" style={inp} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                      <option value="">Select client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group mb16">
                  <label style={lbl}>{isManager ? 'Invite Employees *' : 'Invite Others'}</label>
                  {errors.attendees && <span className="field-error" style={{ display: 'block', marginBottom: 6 }}>{errors.attendees}</span>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {employees.filter(e => e.id !== user?.userId).map(emp => (
                      <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: form.attendees.includes(emp.id) ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${form.attendees.includes(emp.id) ? '#7c3aed66' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.attendees.includes(emp.id)} onChange={() => toggleAttendee(emp.id)} style={{ accentColor: '#7c3aed' }} />
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: emp.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: '#fff' }}>{emp.avatar}</div>
                        <div><div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{emp.name}</div><div style={{ fontSize: '0.65rem', color: '#8890b0' }}>{emp.dept}</div></div>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn" disabled={loading}
                  style={{ width: '100%', height: 44, background: '#7c3aed', color: '#fff', fontWeight: 800, borderRadius: 8, justifyContent: 'center' }}>
                  {loading ? 'Scheduling…' : ' Schedule'}
                </button>
              </form>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 14 }}>📋 Quick View</div>
              {meetDisplayList.filter(m => new Date(m.date + 'T00:00:00') >= now).slice(0, 4).map(m => {
                const d = new Date(m.date + 'T00:00:00');
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: m.type === 'client' ? 'var(--blue)' : 'var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                      <div style={{ fontSize: '0.9rem', lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: '0.55rem', opacity: 0.8 }}>{MONTHS[d.getMonth()]}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#fff' }}>{m.title}</div>
                      <div style={{ fontSize: '0.68rem', color: '#8890b0' }}>⏰ {m.time}</div>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setShowForm(true)} style={{ width: '100%', marginTop: 14, padding: '10px', borderRadius: 8, border: '1px dashed rgba(124,58,237,0.5)', background: 'rgba(124,58,237,0.08)', color: '#a78bfa', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                ＋ Schedule a Meeting
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const lbl = { color: '#8890b0', fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 6 };
const inp = { background: '#1e2035', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' };

export default MeetingList;
